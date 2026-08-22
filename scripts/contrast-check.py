#!/usr/bin/env python3
"""
Would any text land on a background the same colour as itself?

The other half of the bug that shipped. .slist is a white card. Nested inside
.dark-sec, which sets color:#fff, its paragraphs inherited white text onto a white
background, so the box rendered as a large empty white rectangle. The class existed,
the markup was balanced, the copy was correct, and the text was invisible.

Colour inheritance is the whole mechanism, so that is what this walks: for each
element, carry down the nearest ancestor's declared color and background, and report
any element that sets a light background while inheriting light text, or a dark
background while inheriting dark text.

    python3 contrast-check.py <file.html>
"""
import re
import sys
from html.parser import HTMLParser

path = sys.argv[1]
src = open(path, encoding='utf-8').read()
css = re.sub(r'/\*.*?\*/', '', ''.join(re.findall(r'<style>(.*?)</style>', src, re.S)), flags=re.S)

VARS = dict(re.findall(r'(--[\w-]+)\s*:\s*([^;}]+)', css))


def resolve(v: str) -> str:
    v = v.strip()
    for _ in range(4):
        m = re.fullmatch(r'var\((--[\w-]+)\)', v)
        if not m:
            break
        v = VARS.get(m.group(1), '').strip()
    return v


def luminance(v: str):
    """Rough lightness of a colour, or None if it is not a flat colour."""
    v = resolve(v).lower()
    if not v or v.startswith(('linear-gradient', 'radial-gradient', 'none', 'transparent', 'inherit')):
        return None
    if v.startswith('#'):
        h = v[1:7]
        if len(h) == 3:
            h = ''.join(c * 2 for c in h)
        if len(h) != 6:
            return None
        try:
            r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        except ValueError:
            return None
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255
    m = re.match(r'rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?', v)
    if m:
        r, g, b = (float(m.group(i)) for i in (1, 2, 3))
        a = float(m.group(4)) if m.group(4) else 1.0
        if a < 0.35:
            return None
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return {'white': 1.0, 'black': 0.0, '#fff': 1.0, '#000': 0.0}.get(v)


# class -> (declared color, declared background) from single-class rules only.
decl = {}
for grp, body in re.findall(r'([^{}]+)\{([^{}]*)\}', css):
    for sel in grp.split(','):
        sel = sel.strip()
        m = re.fullmatch(r'\.([A-Za-z][\w-]*)', sel)
        if not m:
            continue
        cls = m.group(1)
        col = re.search(r'(?:^|;)\s*color\s*:\s*([^;]+)', body)
        bg = re.search(r'(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)', body)
        c, b = decl.get(cls, (None, None))
        decl[cls] = (col.group(1).strip() if col else c, bg.group(1).strip() if bg else b)

# cls -> True when some compound selector containing .cls sets a colour ON the
# element itself (the selector's last simple part is .cls).
self_colored = {}
# cls -> {descendant tags/classes that a ".cls X { color: ... }" rule colours}
descendant_colored = {}

for grp, body in re.findall(r'([^{}]+)\{([^{}]*)\}', css):
    if not re.search(r'(?:^|;)\s*color\s*:', body):
        continue
    for sel in grp.split(','):
        sel = sel.strip()
        if not sel or '>' in sel:
            continue
        parts = sel.split()
        last = parts[-1]
        # ".dark-sec .ranked" or ".ranked.pop": the element itself gets a colour.
        m = re.fullmatch(r'((?:\.[A-Za-z][\w-]*)+)', last)
        if m and len(parts) >= 1:
            for cls in re.findall(r'\.([A-Za-z][\w-]*)', last):
                self_colored[cls] = True
        # ".slist ul" / ".share-portrait .lbl": a named descendant gets a colour.
        if len(parts) >= 2:
            owner = parts[-2]
            for cls in re.findall(r'\.([A-Za-z][\w-]*)', owner):
                key = last.lstrip('.').lower()
                if re.fullmatch(r'[\w-]+', key):
                    descendant_colored.setdefault(cls, set()).add(key)

VOID = {'br', 'hr', 'img', 'input', 'meta', 'link', 'source'}


class Walker(HTMLParser):
    """Carries colour and background down the tree the way the cascade does.

    A suspicion raised on entering an element is only reported if nothing inside it
    declared its own colour. That distinction is what separates the two cases:

      .hero paints #070707 and sets no colour, but everything inside it
            (.hero-title, .hero-tagline, .hero-eyebrow) declares white. Fine.
      .slist paints #fff and sets no colour, and the paragraphs inside it declared
            nothing, so they kept the white they inherited from .dark-sec. Broken.

    Without that rule the check cries wolf on every dark hero on every HMC site,
    and a check that always fails is a check nobody runs.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        # (tag, classes, inherited_color_luminance, background_luminance, suspicion, child_declared_color, has_text)
        # index 7: tags and class names present inside this element
        self.stack = [['root', set(), 0.05, 0.96, None, False, False, set()]]
        self.findings = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        classes = set((d.get('class') or '').split())
        parent = self.stack[-1]
        for frame in self.stack:
            frame[7].add(tag.lower())
            frame[7].update(c.lower() for c in classes)
        _t, _c, col, bg = parent[0], parent[1], parent[2], parent[3]
        newcol, newbg = col, bg
        declared_color = False
        suspicion = None

        for cls in sorted(classes):
            dc, db = decl.get(cls, (None, None))
            if dc is not None:
                lv = luminance(dc)
                if lv is not None:
                    newcol = lv
                    declared_color = True
            if db is not None:
                lv = luminance(db)
                if lv is not None:
                    newbg = lv
                    # A class that repaints the background without also setting a
                    # colour keeps whatever text colour it inherited. That is only a
                    # defect if nothing inside it fixes the colour, which is decided
                    # on the way back out.
                    if dc is None and abs(newcol - lv) < 0.35:
                        suspicion = (
                            f'.{cls} sets background {resolve(db)} but no color, and nothing '
                            f'inside it declares one, so the text keeps the shade it inherited '
                            f'from <{_t} class="{" ".join(sorted(_c)) or "-"}">. It renders as an '
                            f'empty box.'
                        )

        if declared_color:
            # Tell every open ancestor that a colour was set inside it.
            for frame in self.stack:
                frame[5] = True

        if tag not in VOID:
            self.stack.append([tag, classes, newcol, newbg, suspicion, False, False, set()])

    def handle_data(self, data):
        if data.strip():
            for frame in self.stack:
                frame[6] = True

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i][0] == tag:
                frame = self.stack[i]
                # frame[6]: an element with no words in it cannot have invisible
                # text. Carousel slides and decorative dots paint a background and
                # contain nothing, and reporting them buried the real findings.
                if frame[4] and not frame[5] and frame[6]:
                    cls = frame[4][1:frame[4].index(' ')]
                    # Cleared if a compound rule colours the element itself, or if
                    # a ".cls X { color }" rule names a descendant that is actually
                    # present. Presence is the whole point: ".slist ul" exists, but
                    # the broken markup had paragraphs, so nothing was coloured.
                    rescued = self_colored.get(cls, False) or bool(
                        descendant_colored.get(cls, set()) & frame[7]
                    )
                    if not rescued:
                        self.findings.append(frame[4])
                del self.stack[i:]
                return


body = src[src.index('<body>'):] if '<body>' in src else src
w = Walker()
w.feed(body)

uniq = []
for f in w.findings:
    if f not in uniq:
        uniq.append(f)
if uniq:
    print(f"  TEXT WOULD BE INVISIBLE ({len(uniq)} distinct):")
    for f in uniq:
        print("    -", f)
    sys.exit(1)
print("  no element repaints its background into its own inherited text colour")
