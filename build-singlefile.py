#!/usr/bin/env python3
"""
Bundle LoungeLens into ONE self-contained HTML file.

Inlines styles.css + all JS (data, engine, selfcheck, app) into index.html so the
result opens by double-click with no server, no internet, no install. The PWA bits
(service worker / manifest) are stripped because file:// can't use them — but the
app works fully offline anyway since everything is inline. This file is the thing
you can AirDrop / email / WhatsApp to anyone and it just runs.

Run: python3 build-singlefile.py  ->  dist/loungelens.html
"""
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "dist")
OUT = os.path.join(OUT_DIR, "loungelens.html")

def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()

html = read("index.html")
css = read("styles.css")

# JS files in load order (must match index.html script order)
js_files = [
    "data/cards.js",
    "data/lounges.js",
    "data/meta.js",
    "data/sources.js",
    "engine.js",
    "selfcheck.js",
    "profile.js",
    "auth.js",
    "app.js",
]

# 1. inline the stylesheet
html = html.replace(
    '<link rel="stylesheet" href="styles.css" />',
    "<style>\n" + css + "\n</style>",
)

# 2. drop the PWA manifest link (can't work from file://)
html = re.sub(r'\s*<link rel="manifest"[^>]*>', "", html)

# 3. drop the service-worker registration <script> block (needs http) but KEEP
#    the install-button script harmless — simplest: strip the whole inline PWA
#    script that starts with the SW comment.
html = re.sub(
    r"\s*<script>\s*//\s*PWA:.*?</script>",
    "",
    html,
    flags=re.DOTALL,
)

# 4. replace each <script src="..."></script> with the inlined contents
for rel in js_files:
    code = read(rel)
    pattern = re.compile(r'<script src="' + re.escape(rel) + r'"></script>')
    if not pattern.search(html):
        raise SystemExit(f"ERROR: could not find script tag for {rel} in index.html")
    # use a replacement FUNCTION so backslashes in JS (e.g. regex \s) are inserted
    # literally and never interpreted as re replacement-template escapes.
    replacement = "<script>\n" + code + "\n</script>"
    html = pattern.sub(lambda _m: replacement, html)

# 5. sanity: no remaining external src= local script/style refs
leftovers = re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', html)
# icons + apple-touch are fine to leave (they degrade gracefully); flag JS/CSS
bad = [l for l in leftovers if l.endswith((".js", ".css"))]
if bad:
    raise SystemExit(f"ERROR: un-inlined local assets remain: {bad}")

os.makedirs(OUT_DIR, exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)

size_kb = os.path.getsize(OUT) / 1024
print(f"OK  wrote {os.path.relpath(OUT, ROOT)}  ({size_kb:.1f} KB, single file)")
print(f"    open with: open {os.path.relpath(OUT, ROOT)}")
