"""Step 3: reference links, removed text in place, and colors by category.

Usage: python3 layers.py STEP2.html layers.css layers.js OUT.html
(STEP2.html is the output of enhance.py; its STEP2.html.removed.json must sit beside it.)
"""
import html
import json
import re
import sys

src, cssf, jsf, out = sys.argv[1:5]
d = open(src, encoding="utf-8").read()
removed = json.load(open(src + ".removed.json", encoding="utf-8"))
m = re.search(r'<script type="application/json" id="jg-data">(.*?)</script>', d, re.S)
data = json.loads(m.group(1).replace("<\\/", "</"))
cats, gaps = data["cats"], data["gaps"]

GROUPS = [  # key, label, short tag, preface item; fixed order = fixed color slot
    ("priestly", "Priestly framework and narrative", "Priestly", "removed-2"),
    ("framework", "Framework numbers and headings", "Framework", "removed-1"),
    ("linking", "Linking layer", "Linking layer", "removed-3"),
    ("southern", "Southern addition", "Southern addition", "removed-11"),
    ("peoples", "Lists of peoples", "Peoples list", "removed-12"),
    ("later", "Glosses and blind-tested additions", "Later addition", "removed-4"),
    ("aside", "Set aside, not tested", "Set aside", None),
]
G = {g[0]: g for g in GROUPS}
count = {g[0]: 0 for g in GROUPS}
for gid, g in gaps.items():
    for k, a, b in g["segs"]:
        count[cats[k]["g"]] += b - a + 1
assert sum(count.values()) == len(removed)

kept = {(int(c), int(v)) for c, v in re.findall(r'<span class="vp" id="v(\d+)-(\d+)">', d)}
allv = kept | {tuple(map(int, k.split(":"))) for k in removed}
gap_of = {}
for gid, g in gaps.items():
    for v in range(g["a"], g["b"] + 1):
        gap_of[(g["c"], v)] = gid


def esc(s):
    return html.escape(s, quote=False)


def bar(groups):
    if len(groups) == 1:
        c = "var(--om-%s)" % groups[0]
        return "linear-gradient(%s,%s)" % (c, c)
    step = 100 / len(groups)
    stops = ",".join("var(--om-%s) %.0f%% %.0f%%" % (g, i * step, (i + 1) * step) for i, g in enumerate(groups))
    return "linear-gradient(90deg,%s)" % stops


# ---------- color the markers and place the removed verses after them ----------
for gid, g in gaps.items():
    groups = []
    for k, a, b in g["segs"]:
        if cats[k]["g"] not in groups:
            groups.append(cats[k]["g"])
    short = " · ".join(G[x][2] for x in groups)
    tag = '<button type="button" class="gap" id="%s"' % gid
    assert d.count(tag) == 1, gid
    d = d.replace(tag, tag + ' style="--bar:%s;--cat:var(--om-%s)" data-short="%s"' % (bar(groups), groups[0], esc(short)), 1)

    verses = []
    for k, a, b in g["segs"]:
        grp = cats[k]["g"]
        for v in range(a, b + 1):
            en, he = removed["%d:%d" % (g["c"], v)]
            t = '<span class="rmtag">%s</span>' % G[grp][2] if v == a else ""
            verses.append(
                '<span class="vp rmv" data-gap="%s" data-ref="%d:%d" data-g="%s" style="--cat:var(--om-%s)">'
                '<span class="en">%s<sup class="v">%d</sup>%s </span>'
                '<span class="he" lang="he" dir="rtl">%s<sup class="hv">%d</sup>%s</span></span>'
                % (gid, g["c"], v, grp, grp, t, v, esc(en), t, v, he)
            )
    start = d.index('id="%s"' % gid)
    if g["whole"]:
        end = d.index("</p>\n", start) + 5
        ins = '<p class="vv rmch"><span class="ch" aria-label="Chapter %d">%d</span>%s</p>\n' % (g["c"], g["c"], "".join(verses))
    else:
        end = d.index("</button>", start) + 9
        ins = "".join(verses)
    d = d[:end] + ins + d[end:]

# ---------- links from the preface and Seams to the text ----------
BOOKS = (r"(?:Gen|Exod|Lev|Num|Deut|Josh|Judg|Ruth|[12] Sam|[12] Kgs|[12] Chr|Ezra|Neh|Esth|Job|Pss?|Prov|Eccl|Song|"
         r"Isa|Jer|Lam|Ezek|Dan|Hos|Joel|Amos|Obad|Jonah|Mic|Nah|Hab|Zeph|Hag|Zech|Mal|Matt|Mark|Luke|John|Acts|Rom|Heb|Jub|Sir)")
CV = r"\d{1,2}:\d{1,2}(?:[–-]\d{1,2}(?::\d{1,2})?)?"
CHAIN = re.compile(r"(?P<first>" + CV + r")(?P<rest>(?:(?:, |; |, and | and )(?:again )?(?:" + CV + r"|\d{1,2}(?:[–-]\d{1,2})?(?![\d:])))*)")
PIECE = re.compile(r"\d{1,2}:\d{1,2}(?:[–-]\d{1,2}(?::\d{1,2})?)?|\d{1,2}(?:[–-]\d{1,2})?")
CHAP = re.compile(r"\bGen (?P<a>\d{1,2})(?:[–-]\d{1,2})?(?![\d:,])")
BOOKREF = re.compile(r"\b(?P<b>" + BOOKS + r")\.? (?=\d)")
SENT = re.compile(r"[.!?][”’)\]]*\s+(?=[A-Z“(])|\n")


def find(text):
    """Return (start, end, chapter, verse) for each Genesis reference; verse None = whole chapter."""
    stops = [0] + [s.end() for s in SENT.finditer(text)]
    books = [(b.start(), b.group("b")) for b in BOOKREF.finditer(text)]

    def book_at(pos):
        since = max(s for s in stops if s <= pos)
        last = [b for p, b in books if since <= p <= pos]
        return last[-1] if last else "Gen"

    found = []
    for mm in CHAIN.finditer(text):
        if book_at(mm.start()) != "Gen":
            continue
        ch = None
        for p in PIECE.finditer(mm.group(0)):
            t = p.group()
            if ":" in t:
                ch, vv = t.split(":")[:2]
                ch = int(ch)
            else:
                vv = t
            found.append((mm.start() + p.start(), mm.start() + p.end(), ch, int(re.match(r"\d+", vv).group())))
    for mm in CHAP.finditer(text):
        found.append((mm.start("a"), mm.end(), int(mm.group("a")), None))
    return found


def target(c, v):
    if v is None:
        v = 1
    if (c, v) in kept:
        return "v%d-%d" % (c, v)
    return gap_of.get((c, v))


def link_section(doc, sec_id):
    a = doc.index('id="%s"' % sec_id)
    b = doc.index("</section>", a)
    chunk = doc[a:b]
    plain, pos, i = [], [], 0
    for t in re.finditer(r"<[^>]+>|[^<]+", chunk):
        if not t.group().startswith("<"):
            for j, ch in enumerate(t.group()):
                plain.append(ch)
                pos.append(t.start() + j)
    plain = "".join(plain)
    links = []
    for s, e, c, v in find(plain):
        if (c, v or 1) not in allv:
            continue
        hs, he_ = pos[s], pos[e - 1] + 1
        if he_ - hs != e - s:
            continue  # crosses markup; leave it alone
        links.append((hs, he_, c, v))
    links.sort(reverse=True)
    for hs, he_, c, v in links:
        ref = "%d" % c if v is None else "%d:%d" % (c, v)
        chunk = chunk[:hs] + '<a class="xref" href="#%s" data-xref="%s">%s</a>' % (target(c, v), ref, chunk[hs:he_]) + chunk[he_:]
    print(sec_id, "links:", len(links))
    return doc[:a] + chunk + doc[b:]


d = link_section(d, "preface")
d = link_section(d, "seams")

# ---------- the key ----------
def key_items(link):
    items = []
    for k, label, short, why in GROUPS:
        sw = '<span class="sw" style="background:var(--om-%s)"></span>' % k
        lab = '<a href="#%s" class="xref">%s</a>' % (why, label) if (link and why) else label
        items.append('<li>%s%s <span class="n">%d</span></li>' % (sw, lab, count[k]))
    return "".join(items)


d = d.replace(
    "<p>Click any mark in the text for its meaning",
    '<p id="omission-key"><strong>Omissions by category.</strong> The mark […] carries the color of what was removed there; '
    "with “Removed” on, the verses return in place, shaded or struck through in the same color. "
    "Numbers are verses removed.</p>\n"
    '<ul class="omkey">%s</ul>\n<p>Click any mark in the text for its meaning' % key_items(True),
    1,
)
d = d.replace(
    '<button id="gaps" aria-pressed="true" title="Show where verses were removed">Omissions</button>',
    '<button id="gaps" aria-pressed="true" title="Show where verses were removed">Omissions</button>\n'
    '  <button id="rmmode" data-mode="off" title="Show removed verses in place: off, shaded, struck through">Removed: hidden</button>',
)
nav_end = d.index("</div></nav>")
d = d[:nav_end] + '  <ul class="omkey navkey" aria-label="Key to removed text">%s</ul>\n' % key_items(False) + d[nav_end:]

# apparatus rows get their swatch
def sw_row(mm):
    k = int(mm.group(1)) - 1
    return mm.group(0) + '<span class="sw" style="background:var(--om-%s)"></span>' % cats[k]["g"]


d = re.sub(r'<tr id="app-(\d+)"><th scope="row">', sw_row, d)

d = d.replace("</style>", open(cssf, encoding="utf-8").read() + "</style>", 1)
d = d.replace("</body>", "<script>\n" + open(jsf, encoding="utf-8").read() + "</script>\n</body>", 1)
open(out, "w", encoding="utf-8").write(d)
print("groups:", count)
