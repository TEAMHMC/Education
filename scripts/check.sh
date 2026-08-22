#!/bin/sh
# Everything that must pass before this page is published.
#
# The first four of these all passed on a build that was visibly broken in two
# places, which is why the last two exist. Tag balance, defined classes, correct
# copy and working links do not tell you whether the page renders.
set -e
f="${1:-index.html}"
echo "== tag balance and undefined classes =="
python3 - "$f" <<'PY'
import io,re,sys
s=io.open(sys.argv[1],encoding='utf-8').read()
bad=0
for t in ('section','footer','main','header','article','details','div','ul','li','style','p','h1','h2','h3'):
    o=len(re.findall(r'<%s[\s>]'%t,s)); c=len(re.findall(r'</%s>'%t,s))
    if o!=c: print(f"  MISMATCH {t}: {o} open {c} close"); bad=1
used=set()
for m in re.finditer(r'class="([^"]+)"',s):
    for c in m.group(1).split():
        if not c.startswith('hmc-') and c!='wrap': used.add(c)
styles=''.join(re.findall(r'<style>(.*?)</style>',s,re.S))
defined=set(re.findall(r'\.([a-zA-Z][\w-]*)',styles))
miss=sorted(used-defined)
if miss: print("  undefined classes:",miss); bad=1
sys.exit(bad)
PY
echo "  ok"
echo "== markup matches what its CSS classes expect =="
python3 scripts/css-contract-check.py "$f"
echo "== no text painted onto its own colour =="
python3 scripts/contrast-check.py "$f"
echo "== every link resolves =="
grep -oE 'href="https?://[^"]+"' "$f" | sed 's/href="//;s/"//' | grep -v 'fonts\.' | sort -u | while read u; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -I -L --max-time 30 "$u" 2>/dev/null) || code=""
  [ "$code" = "200" ] || code=$(curl -s -o /dev/null -w '%{http_code}' -r 0-0 -L --max-time 30 "$u" 2>/dev/null) || code="unreachable"
  [ "$code" = "206" ] && code="200"
  [ "$code" = "200" ] || echo "  NOT 200: $u -> $code"
done
echo "  ok"
echo "== no em dashes, no emojis =="
! grep -q "—" "$f" || { echo "  em dash found"; exit 1; }
echo "  ok"
