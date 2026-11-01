"""Insert Westminster Leningrad Codex Hebrew into the Josephite Genesis HTML.

Usage: python3 build.py SOURCE.html Gen.xml OUT.html
"""
import html
import re
import sys
import xml.etree.ElementTree as ET

src, wlc, out = sys.argv[1:4]
NS = {"o": "http://www.bibletechnologies.net/2003/OSIS/namespace"}
Q = "{http://www.bibletechnologies.net/2003/OSIS/namespace}"


def word(w):
    return (w.text or "").replace("/", "")


def verse_hebrew(v):
    """Render one OSIS verse as HTML: words, maqqef joins, ketiv/qere, markers."""
    parts = []  # list of (html, joins_next)
    for el in v:
        tag = el.tag.replace(Q, "")
        if tag == "w":
            if el.get("type") == "x-ketiv":
                parts.append(('<span class="kt" title="Ketiv (written)">' + html.escape(word(el)) + "</span>", False))
            else:
                parts.append((html.escape(word(el)), False))
        elif tag == "seg":
            t = el.get("type")
            s = el.text or ""
            if t == "x-maqqef":
                parts[-1] = (parts[-1][0] + s, True)
            elif t == "x-sof-pasuq":
                parts[-1] = (parts[-1][0] + s, parts[-1][1])
            elif t == "x-paseq":
                parts.append((s, False))
            elif t in ("x-pe", "x-samekh"):
                label = "petuḥah (open paragraph)" if t == "x-pe" else "setumah (closed paragraph)"
                parts.append(('<span class="pm" title="' + label + '">' + s + "</span>", False))
        elif tag == "note" and el.get("type") == "variant":
            rdg = el.find("o:rdg", NS)
            if rdg is not None and rdg.get("type") == "x-qere":
                q = " ".join(word(w) for w in rdg.findall("o:w", NS))
                parts.append(('<span class="qr" title="Qere (read)">[' + html.escape(q) + "]</span>", False))
    buf = ""
    for i, (h, joins) in enumerate(parts):
        buf += h
        if i < len(parts) - 1 and not joins:
            buf += " "
    return buf


root = ET.parse(wlc).getroot()
heb = {}
for v in root.iter(Q + "verse"):
    _, c, n = v.get("osisID").split(".")
    heb[(int(c), int(n))] = verse_hebrew(v)

doc = open(src, encoding="utf-8").read()

PARA = re.compile(r'<p><span class="ch" aria-label="Chapter (\d+)">\d+</span>(.*?)</p>', re.S)
SUP = re.compile(r'(?=<sup class="v">\d+</sup>)')
VNUM = re.compile(r'<sup class="v">(\d+)</sup>')
TAG = re.compile(r"<(/?)([a-z0-9]+)[^>]*>")
missing = []
count = 0


def balanced(s):
    stack = []
    for m in TAG.finditer(s):
        if m.group(2) == "br":
            continue
        if m.group(1):
            if not stack or stack.pop() != m.group(2):
                return False
        else:
            stack.append(m.group(2))
    return not stack


def para(m):
    global count
    ch = int(m.group(1))
    body = m.group(2)
    chunks = [c for c in SUP.split(body) if c]
    out = ['<p class="vv"><span class="ch" aria-label="Chapter %d">%d</span>' % (ch, ch)]
    for c in chunks:
        vn = VNUM.match(c)
        assert vn, "text before first verse in chapter %d: %r" % (ch, c[:80])
        assert balanced(c), "unbalanced markup in %d:%s" % (ch, vn.group(1))
        n = int(vn.group(1))
        h = heb.get((ch, n))
        if h is None:
            missing.append("%d:%d" % (ch, n))
            h = ""
        count += 1
        out.append(
            '<span class="vp" id="v%d-%d"><span class="en">%s</span>'
            '<span class="he" lang="he" dir="rtl"><sup class="hv">%d</sup>%s</span></span>'
            % (ch, n, c.rstrip() + " ", n, h)
        )
    out.append("</p>")
    return "".join(out)


doc = PARA.sub(para, doc)
print("verses wrapped:", count, "missing hebrew:", missing)

# ---- head: Hebrew font, CSS ----
doc = doc.replace(
    "family=Source+Sans+3:wght@400;600&display=swap",
    "family=Source+Sans+3:wght@400;600&family=Noto+Serif+Hebrew:wght@400;500&display=swap",
)
CSS = open(sys.argv[0].replace("build.py", "add.css"), encoding="utf-8").read()
doc = doc.replace("</style>", CSS + "</style>", 1)

# ---- nav controls ----
doc = doc.replace(
    '<button id="sigs" aria-pressed="true" title="Show sigla">Sigla</button>',
    '<button id="sigs" aria-pressed="true" title="Show sigla">Sigla</button>\n'
    '  <span class="seg" role="group" aria-label="Text language">'
    '<button data-lang="en" aria-pressed="true" title="English reading text">English</button>'
    '<button data-lang="par" aria-pressed="false" title="English and Hebrew, verse by verse">Parallel</button>'
    '<button data-lang="he" aria-pressed="false" title="Hebrew of the Leningrad Codex">עברית</button>'
    "</span>\n"
    '  <button id="point" class="heonly" title="Cycle Hebrew pointing: full, vowels only, consonants only">Pointing: full</button>',
)

# ---- note under the nav, shown in Hebrew modes ----
doc = doc.replace(
    '<main class="wrap">',
    '<main class="wrap">\n<p class="henote" role="note">Hebrew: the Leningrad Codex (Westminster Leningrad Codex 4.20, '
    'Open Scriptures Hebrew Bible edition). Each Hebrew line gives the <em>whole</em> Masoretic verse. '
    'Where the English drops a phrase inside a verse, or reads “God” for YHWH or “the king” for Pharaoh, '
    'the Hebrew keeps the received wording. Ketiv appears in gray, with qere in brackets; '
    'פ and ס mark open and closed paragraphs.</p>',
    1,
)

# ---- apparatus/footer credit ----
doc = doc.replace(
    "base text World English Bible (public domain)</div></footer>",
    "base text World English Bible (public domain) · Hebrew text Westminster Leningrad Codex (public domain), "
    'via the <a href="https://github.com/openscriptures/morphhb">Open Scriptures Hebrew Bible</a></div></footer>',
)

# ---- script ----
JS = open(sys.argv[0].replace("build.py", "add.js"), encoding="utf-8").read()
doc = re.sub(r"<script>\n\(function\(\)\{.*?</script>", lambda _: "<script>\n" + JS + "</script>", doc, count=1, flags=re.S)

open(out, "w", encoding="utf-8").write(doc)
