"""Make sigla and omissions clickable in the Josephite Genesis page.

Usage: python3 enhance.py INDEX.html Gen.xml web_genesis.json enhance.css enhance.js OUT.html
"""
import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import OrderedDict

src, wlc, webjson, cssf, jsf, out = sys.argv[1:7]
d = open(src, encoding="utf-8").read()
Q = "{http://www.bibletechnologies.net/2003/OSIS/namespace}"
NS = {"o": Q[1:-1]}


# ---------- Hebrew and English for every verse ----------
def word(w):
    return (w.text or "").replace("/", "")


def verse_hebrew(v):
    parts = []
    for el in v:
        tag = el.tag.replace(Q, "")
        if tag == "w":
            cls = ' class="kt"' if el.get("type") == "x-ketiv" else ""
            parts.append(["<span%s>%s</span>" % (cls, html.escape(word(el))) if cls else html.escape(word(el)), False])
        elif tag == "seg":
            t, s = el.get("type"), el.text or ""
            if t == "x-maqqef":
                parts[-1] = [parts[-1][0] + s, True]
            elif t == "x-sof-pasuq":
                parts[-1][0] += s
            elif t == "x-paseq":
                parts.append([s, False])
            elif t in ("x-pe", "x-samekh"):
                parts.append(['<span class="pm">%s</span>' % s, False])
        elif tag == "note" and el.get("type") == "variant":
            rdg = el.find("o:rdg", NS)
            if rdg is not None and rdg.get("type") == "x-qere":
                parts.append(['<span class="qr">[%s]</span>' % html.escape(" ".join(word(w) for w in rdg.findall("o:w", NS))), False])
    return "".join(h + ("" if j or i == len(parts) - 1 else " ") for i, (h, j) in enumerate(parts))


heb = {}
for v in ET.parse(wlc).getroot().iter(Q + "verse"):
    _, c, n = v.get("osisID").split(".")
    heb[(int(c), int(n))] = verse_hebrew(v)

web = OrderedDict()
for e in json.load(open(webjson, encoding="utf-8")):
    if "verseNumber" in e and "value" in e:
        c, v = e["chapterNumber"], e["verseNumber"]
        if c == 31 and v == 55:
            c, v = 32, 1  # Hebrew versification
        elif c == 32:
            v += 1
        web[(c, v)] = web.get((c, v), "") + e["value"]
web = {k: re.sub(r"\s+", " ", t).strip() for k, t in web.items()}
assert set(web) == set(heb), "versification mismatch"

kept = {(int(c), int(v)) for c, v in re.findall(r'<span class="vp" id="v(\d+)-(\d+)">', d)}

# ---------- ids for the explanations ----------
def number_items(doc, heading, prefix):
    start = doc.index("<h2>%s</h2>" % heading)
    end = doc.index("</ol>", start)
    block = doc[start:end]
    n = [0]

    def li(m):
        n[0] += 1
        return '\n  <li id="%s-%d">' % (prefix, n[0])

    block = re.sub(r"\n  <li>", li, block)
    return doc[:start] + block + doc[end:], n[0]


d, n_repl = number_items(d, "What was replaced", "replaced")
d, n_rem = number_items(d, "What was removed", "removed")
assert (n_repl, n_rem) == (6, 13), (n_repl, n_rem)
d = d.replace("<h2>What was kept, and what remains", '<h2 id="kept">What was kept, and what remains', 1)
d = d.replace("<h2>Sigla</h2>", '<h2 id="sigla">Sigla</h2>', 1)

legend = {}
for cls, dd in re.findall(r'<dt><span class="sig (\w)"[^>]*>.*?</span></dt><dd>(.*?)</dd>', d):
    legend[cls] = dd
d = re.sub(r'<dt><span class="sig (\w)"', r'<dt id="sig-\1"><span class="sig \1"', d)

# ---------- apparatus categories ----------
CAT_TARGET = {  # apparatus row -> (preface item, its short title, color group)
    "Framework numbers in the name lists": ("removed-1", "Framework numbers and headings", "framework"),
    "Other framework numbers": ("removed-1", "Framework numbers and headings", "framework"),
    "Priestly framework and narrative": ("removed-2", "Priestly framework and narrative", "priestly"),
    "Priestly departure notice": ("removed-2", "Priestly framework and narrative", "priestly"),
    "Linking layer": ("removed-3", "The linking layer", "linking"),
    "Etiological note": ("removed-4", "Glosses", "later"),
    "Southern addition": ("removed-11", "The southern addition", "southern"),
    "Table of Nations": ("removed-12", "The Table of Nations", "peoples"),
    "Saying in the narrator": ("removed-12", "The Table of Nations", "peoples"),
    "Genealogies of peoples": ("removed-13", "The genealogies of peoples", "peoples"),
    "Later additions coded detachable": ("removed-7", "Canaan in Gen 9, and the Sodom story", "later"),
    "Set aside, not tested": (None, None, "aside"),
}
cats = []
cat_of = {}
app_start = d.index('id="apparatus"')
rows = list(re.finditer(r'<tr><th scope="row">(.*?)</th><td class="n">(\d+)</td><td class="refs">(.*?)</td></tr>', d[app_start:]))
ref_pieces = []  # (row index, piece text, first verse)
for i, row in enumerate(rows):
    name = html.unescape(re.sub("<[^>]+>", "", row.group(1)))
    target = next(v for k, v in CAT_TARGET.items() if name.startswith(k))
    cats.append({"name": name, "row": "app-%d" % (i + 1), "why": target[0], "whyLabel": target[1], "g": target[2]})
    ch = None
    pieces = []
    for part in row.group(3).split(";"):
        for piece in part.split(","):
            p = piece.strip()
            body = p
            if ":" in body:
                ch, body = body.split(":")
                ch = int(ch)
            a, _, b = body.replace("–", "-").partition("-")
            a = int(a)
            b = int(b) if b else a
            for v in range(a, b + 1):
                assert (ch, v) not in kept and (ch, v) not in cat_of
                cat_of[(ch, v)] = i
            pieces.append((p, (ch, a)))
    ref_pieces.append(pieces)
missing = sorted(set(web) - kept)
assert set(missing) == set(cat_of), "apparatus does not match the text"

# ---------- runs of omitted verses, per chapter ----------
runs = []
for c, v in missing:
    if runs and runs[-1]["c"] == c and runs[-1]["b"] == v - 1:
        runs[-1]["b"] = v
    else:
        runs.append({"c": c, "a": v, "b": v})
verses_in = {}
for c, v in web:
    verses_in[c] = max(verses_in.get(c, 0), v)
gap_of = {}
for r in runs:
    r["id"] = "gap-%d-%d" % (r["c"], r["a"])
    r["whole"] = r["a"] == 1 and r["b"] == verses_in[r["c"]]
    segs = []
    for v in range(r["a"], r["b"] + 1):
        k = cat_of[(r["c"], v)]
        if segs and segs[-1][0] == k and segs[-1][2] == v - 1:
            segs[-1][2] = v
        else:
            segs.append([k, v, v])
    r["segs"] = segs
    for v in range(r["a"], r["b"] + 1):
        gap_of[(r["c"], v)] = r["id"]


def ref(c, a, b):
    return "%d:%d" % (c, a) if a == b else "%d:%d–%d" % (c, a, b)


# ---------- insert markers ----------
edits = []  # (index, order, text)
for r in runs:
    c = r["c"]
    label = "Genesis %d omitted" % c if r["whole"] else "Omitted: %s" % ref(c, r["a"], r["b"])
    if r["whole"]:
        nxt = min(cc for cc, _ in kept if cc > c)
        idx = d.index('<p class="vv"><span class="ch" aria-label="Chapter %d">' % nxt)
        names = "; ".join(OrderedDict((cats[s[0]]["name"], 1) for s in r["segs"]))
        text = ('<p class="gapblock"><button type="button" class="gap" id="%s" data-gap="%s" aria-label="%s">'
                '<span class="gl">Genesis %d</span> <span class="gn">omitted · %s</span></button></p>\n'
                % (r["id"], r["id"], html.escape(label), c, html.escape(names)))
        edits.append((idx, c, text))
        continue
    after = [v for cc, v in kept if cc == c and v > r["b"]]
    marker = ('<button type="button" class="gap" id="%s" data-gap="%s" aria-label="%s" title="%s">'
              '<span aria-hidden="true">[…]</span></button>' % (r["id"], r["id"], html.escape(label), html.escape(label)))
    if after:
        idx = d.index('<span class="vp" id="v%d-%d">' % (c, min(after)))
    else:
        last = max(v for cc, v in kept if cc == c)
        idx = d.index("</p>", d.index('<span class="vp" id="v%d-%d">' % (c, last)))
        marker = " " + marker
    edits.append((idx, c, marker))

# ---------- sigla become buttons ----------
R_TARGET = [  # (test on the preceding words, target, gloss)
    (r"\b(?:king|king’s|Egypt)$", "replaced-1", "“the king” stands where the base text reads “Pharaoh.”"),
    (r"\bLuz$", "replaced-3", "Luz stands where the base text reads Bethel."),
    (r"\bservants?$", "replaced-4", "“servant” stands where the base text reads “officer” (Hebrew <i>sārîs</i>)."),
    (r"\b(?:Gerar|place|land)$", "replaced-2", "Gerar stands for the Philistines, or “the lord of the land” for “governor.”"),
]
SIG_TARGET = {"p": "removed-2", "d": "replaced-6", "t": "kept", "s": "sigla"}
SIG_WHY = {"p": "Priestly framework and narrative", "d": "The divine name", "t": "What was kept", "s": "Sigla"}
NAMES = {"p": "Priestly content kept", "t": "Later name or object kept", "s": "Poetry, not tested",
         "d": "Yahweh read as “God”", "r": "Later word read as the older word"}
unmatched = []
sig_re = re.compile(r'<span class="sig (\w)" title="([^"]*)">(.*?)</span>')


def sig(m):
    cls, title, sym = m.groups()
    pre = re.sub(r"<[^>]+>", "", m.string[max(0, m.start() - 120):m.start()]).rstrip(" ,.;:”’“")
    target, why, gloss = SIG_TARGET.get(cls), SIG_WHY.get(cls), ""
    if cls == "r":
        for pat, tgt, gl in R_TARGET:
            if re.search(pat, pre):
                target, gloss = tgt, gl
                break
        else:
            target = "replaced-1"
            unmatched.append(pre[-40:])
        why = {"replaced-1": "“Pharaoh” read as “the king”", "replaced-2": "The Philistines and “governor”",
               "replaced-3": "Bethel read as Luz", "replaced-4": "The court official <i>sārîs</i>"}[target]
    if cls == "d":
        gloss = "“God” stands where the base text, and the Hebrew, read the name YHWH."
    return ('<button type="button" class="sig %s" data-sig="%s" data-to="%s" data-why="%s" data-gloss="%s" '
            'title="%s" aria-label="%s: %s">%s</button>'
            % (cls, cls, target, html.escape(why), html.escape(gloss), title, NAMES[cls], html.escape(title), sym))


body_start = d.index('<section class="part" id="part1">')
body_end = d.index('<section class="front" id="seams">')

# apply marker edits inside the body slice, then splice; indices are relative to d, so apply before sigla
edits.sort(key=lambda e: (e[0], e[1]), reverse=True)
d2 = d
for idx, _, text in edits:
    d2 = d2[:idx] + text + d2[idx:]
d = d2
body_start = d.index('<section class="part" id="part1">')
body_end = d.index('<section class="front" id="seams">')
d = d[:body_start] + sig_re.sub(sig, d[body_start:body_end]) + d[body_end:]

# ---------- apparatus: row ids and linked references ----------
app_start = d.index('id="apparatus"')
head, tail = d[:app_start], d[app_start:]
i = [0]


def linkrow(m):
    k = i[0]
    i[0] += 1
    links = []
    out_parts = []
    pieces = iter(ref_pieces[k])
    for part in m.group(3).split(";"):
        bits = []
        for piece in part.split(","):
            p, (c, a) = next(pieces)
            lead = piece[: len(piece) - len(piece.lstrip())]
            bits.append('%s<a href="#%s" data-gaplink="%s-%d">%s</a>' % (lead, gap_of[(c, a)], c, a, p))
        out_parts.append(",".join(bits))
    return '<tr id="app-%d"><th scope="row">%s</th><td class="n">%s</td><td class="refs">%s</td></tr>' % (
        k + 1, m.group(1), m.group(2), ";".join(out_parts))


tail = re.sub(r'<tr><th scope="row">(.*?)</th><td class="n">(\d+)</td><td class="refs">(.*?)</td></tr>', linkrow, tail)
d = head + tail

# ---------- removed verses, kept in the page for the inline mode (layers.py places them) ----------
removed_verses = {"%d:%d" % k: [web[k], heb[k]] for k in missing}
json.dump(removed_verses, open(out + ".removed.json", "w", encoding="utf-8"), ensure_ascii=False)

# ---------- data for the popovers ----------
data = {
    "cats": cats,
    "legend": legend,
    "gaps": {r["id"]: {"c": r["c"], "a": r["a"], "b": r["b"], "whole": r["whole"],
                       "segs": [[s[0], s[1], s[2]] for s in r["segs"]]} for r in runs},
}
blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
d = d.replace("<script>\n(function(){", '<script type="application/json" id="jg-data">' + blob + "</script>\n<script>\n(function(){", 1)

# ---------- nav button, css, js ----------
d = d.replace(
    '<button id="sigs" aria-pressed="true" title="Show sigla">Sigla</button>',
    '<button id="sigs" aria-pressed="true" title="Show sigla">Sigla</button>\n'
    '  <button id="gaps" aria-pressed="true" title="Show where verses were removed">Omissions</button>',
)
d = d.replace("</style>", open(cssf, encoding="utf-8").read() + "</style>", 1)
d = d.replace("</body>", "<script>\n" + open(jsf, encoding="utf-8").read() + "</script>\n</body>", 1)
d = d.replace(
    "<p>The marks ‡ and § stand at the start",
    "<p>Click any mark in the text for its meaning and the reasoning behind it. "
    "The mark […] shows where whole verses were removed; click it for the category, the reasoning, "
    "and the omitted verses in English and Hebrew.</p>\n<p>The marks ‡ and § stand at the start",
    1,
)
print("※ unmatched:", unmatched)
open(out, "w", encoding="utf-8").write(d)
print("runs:", len(runs), "whole chapters:", [r["c"] for r in runs if r["whole"]])
