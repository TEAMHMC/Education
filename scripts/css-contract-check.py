#!/usr/bin/env python3
"""
Does the markup match what its CSS classes expect?

Written because two separate design bugs shipped to production inside an hour and
neither was caught by the checks that ran. Tag balance passed. Every class used was
defined. All 45 sentences of approved copy were present. Every link returned 200.
The page was still visibly broken, because:

  .slist   styles h3 and "ul li". The markup gave it bare <p><b> children, so it
           rendered as a large empty white box with invisible text.
  .statement styles a CHILD p at 28-58px on a blue panel. The class was put on the
           paragraph itself, so .statement p never matched and the result was a raw
           blue rectangle with body-sized text inside a black section.

Both are the same mistake: using a class without reading what shape it expects.
This reads the stylesheet, finds every descendant rule (".x y"), and reports any
element carrying .x that contains no y. It is not a renderer, and it will not catch
everything, but it catches exactly the failure that shipped twice.

    python3 css-contract-check.py <file.html>
"""
import re
import sys
from html.parser import HTMLParser

path = sys.argv[1]
src = open(path, encoding='utf-8').read()
css = ''.join(re.findall(r'<style>(.*?)</style>', src, re.S))
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)

# Descendant contracts: ".card p { ... }" means an element with class "card" is
# expected to contain a p somewhere inside it. Only single-word descendants, and
# only bare element names, because ".a .b" is a class the existence check covers.
contracts = {}
for selector_group, _body in re.findall(r'([^{}]+)\{([^{}]*)\}', css):
    for sel in selector_group.split(','):
        sel = sel.strip()
        m = re.fullmatch(r'\.([A-Za-z][\w-]*)\s+([a-z][a-z0-9]*)', sel)
        if m:
            contracts.setdefault(m.group(1), set()).add(m.group(2))

# Pseudo-element and state rules are not structural requirements.
for cls in list(contracts):
    contracts[cls] = {t for t in contracts[cls] if t not in ('hover', 'focus', 'before', 'after')}
    if not contracts[cls]:
        del contracts[cls]

VOID = {'br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr'}


class Checker(HTMLParser):
    """Tracks which classed elements are open and what tags appear inside them."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [(tag, {classes}, {tags seen inside})]
        self.findings = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        classes = set((d.get('class') or '').split())
        for _t, _c, seen in self.stack:
            seen.add(tag)
        if tag not in VOID:
            self.stack.append((tag, classes, set()))

    def handle_startendtag(self, tag, attrs):
        for _t, _c, seen in self.stack:
            seen.add(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                _t, classes, seen = self.stack.pop(i)
                for cls in classes:
                    req = contracts.get(cls, set())
                    if not req:
                        continue
                    # Two signals, both of which were the actual production bugs,
                    # and neither of which fires on a class whose descendant rules
                    # are simply optional (".faq-answer a" styles a link when there
                    # is one; a paragraph without a link is not a defect).
                    #
                    # 1. The class is applied to the very element it expects to
                    #    contain. .statement styles a child p at 58px; put on the
                    #    p itself, that rule never matches and the panel renders at
                    #    body size. A class sitting one level too low.
                    if _t in req:
                        self.findings.append(
                            f".{cls} styles a child <{_t}>, but the class is ON a <{_t}>. "
                            f"Its .{cls} {_t} rule cannot match. Wrap it instead."
                        )
                    # 2. None of the descendants the class styles are present at
                    #    all. .slist styles h3 and ul li; given only paragraphs it
                    #    renders as an empty box.
                    elif not (req & seen):
                        self.findings.append(
                            f".{cls} styles descendants {sorted(req)} but this <{_t}> "
                            f"contains none of them, so those rules never apply"
                        )
                del self.stack[i:]
                return


body = src[src.index('<body>'):] if '<body>' in src else src
c = Checker()
c.feed(body)

print(f"  contracts read from the stylesheet: {len(contracts)}")
seen_once = []
for f in c.findings:
    if f not in seen_once:
        seen_once.append(f)
if seen_once:
    print(f"  MARKUP DOES NOT MATCH THE STYLESHEET ({len(seen_once)} distinct):")
    for f in seen_once:
        print("    -", f)
    sys.exit(1)
print("  every classed element contains the descendants its CSS styles")
