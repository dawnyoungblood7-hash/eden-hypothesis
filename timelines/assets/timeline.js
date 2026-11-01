/* Shared engine for the Eden Hypothesis timelines.
   Each page defines window.TL (see timelines/data/*.js) and loads this file. */
(function(){
"use strict";
var C = window.TL;
var KINDS = {
  record:      {name:"Archaeological record", v:"--k-record"},
  text:        {name:"Texts and inscriptions", v:"--k-text"},
  thesis:      {name:"The book’s thesis and chronology", v:"--k-thesis"},
  scholarship: {name:"Scholarship", v:"--k-scholarship"},
  climate:     {name:"Geology and climate", v:"--k-climate"}
};
var MARKS = {
  book:  "On the book’s chronology",
  claim: "Contested or refuted claim",
  hist:  "Historiographical date"
};
var PAGES = [
  {id:"neolithic", t:"Deep Time and the Neolithic"},
  {id:"chalcolithic", t:"Copper, Cities, and Writing"},
  {id:"early-bronze", t:"The Early Bronze Age"},
  {id:"middle-bronze", t:"The Middle Bronze Age"},
  {id:"late-bronze", t:"The Late Bronze Age"},
  {id:"iron-age", t:"The Iron Age"},
  {id:"persian-hellenistic", t:"Persian and Hellenistic"},
  {id:"genesis-dating", t:"When Was Genesis Written?"},
  {id:"long-memory", t:"Long Memory"}
];
var PERIODS = [
 [-20000,-9700,"Epipaleolithic","Epipal."],
 [-9700,-8500,"Pre-Pottery Neolithic A","PPNA"],
 [-8500,-6400,"Pre-Pottery Neolithic B","PPNB"],
 [-6400,-4500,"Pottery Neolithic","PN"],
 [-4500,-3300,"Chalcolithic","Chalco."],
 [-3300,-2000,"Early Bronze Age","EBA"],
 [-2000,-1550,"Middle Bronze Age","MBA"],
 [-1550,-1177,"Late Bronze Age","LBA"],
 [-1177,-539,"Iron Age","Iron"],
 [-539,-332,"Persian","Pers."],
 [-332,-63,"Hellenistic","Hell."],
 [-63,400,"Roman","Rom."]
];
// Egyptian periods after Clayton, Chronicle of the Pharaohs (1994)
var EGYPT = [
 [-3150,-2686,"Early Dynastic","E. Dyn."],
 [-2686,-2181,"Old Kingdom","OK"],
 [-2181,-2040,"First Intermediate","FIP"],
 [-2040,-1782,"Middle Kingdom","MK"],
 [-1782,-1570,"Second Intermediate","SIP"],
 [-1570,-1070,"New Kingdom","NK"],
 [-1069,-525,"Third Intermediate","TIP"],
 [-525,-332,"Late Period","Late"],
 [-332,400,"Graeco-Roman","Gr.-Rom."]
];
var NS = "http://www.w3.org/2000/svg";
var PAD = 16, BAND_H = C.egypt ? 42 : 22, TOP = BAND_H + 14, ROW = 40, AXIS_H = 28;
var MIN_SPAN = C.minSpan || 40;

// ---------- data ----------
var EVENTS = [], GROUPS = null;
if (C.groups){
  GROUPS = C.groups;
  C.groups.forEach(function(g, gi){ g.events.forEach(function(e){ e.group = gi; EVENTS.push(e); }); });
} else EVENTS = C.events.slice();
EVENTS.forEach(function(e, i){ e.id = i + 1; if (e.e === undefined) e.e = e.s; });
var PRE = (C.prelude && C.prelude.events) || [];
PRE.forEach(function(e, i){ e.id = 1000 + i; if (e.e === undefined) e.e = e.s; e.pre = true; });
var ALL = EVENTS.concat(PRE);

var domain = C.views[0].d.slice();
var hidden = {}, selected = null, anim = null;

// ---------- helpers ----------
function $(id){ return document.getElementById(id); }
function mk(tag, attrs, parent){
  var n = document.createElementNS(NS, tag);
  for (var k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function color(kind){ return "var(" + KINDS[kind].v + ")"; }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function rich(s){ // *italic* markup
  return esc(s).replace(/\*([^*]+)\*/g, "<i>$1</i>");
}
function fmtYear(y){
  y = Math.round(y);
  if (y > 0) return "AD " + y;
  if (y === 0) return "1 BC";
  var a = -y;
  return (a >= 10000 ? a.toLocaleString("en-US") : String(a)) + " BC";
}
function fmtAgo(v){
  if (v >= 1e6) return (v/1e6).toLocaleString("en-US",{maximumFractionDigits:1}) + " million years ago";
  return Math.round(v).toLocaleString("en-US") + " years ago";
}
var mctx = document.createElement("canvas").getContext("2d");
function textW(t){ mctx.font = '13px "Source Sans 3", system-ui, sans-serif'; return mctx.measureText(t).width; }
function smallW(t){ mctx.font = '11px "Source Sans 3", system-ui, sans-serif'; return mctx.measureText(t).width; }
function shown(e){ return !hidden[e.kind]; }
function byId(id){ for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id) return ALL[i]; return null; }
function markerSVG(kind, mark, size){
  size = size || 12; var c = kind ? color(kind) : "var(--muted)", h = size/2;
  var s = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">';
  if (mark === "book") s += '<path d="M' + h + ' 0.5L' + (size-0.5) + ' ' + h + 'L' + h + ' ' + (size-0.5) + 'L0.5 ' + h + 'Z" fill="' + c + '"/>';
  else if (mark === "claim") s += '<circle cx="' + h + '" cy="' + h + '" r="' + (h-1.5) + '" fill="none" stroke="' + c + '" stroke-width="2"/>';
  else if (mark === "hist") s += '<circle cx="' + h + '" cy="' + h + '" r="' + (h-1.5) + '" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-dasharray="2.2 1.8"/>';
  else s += '<circle cx="' + h + '" cy="' + h + '" r="' + (h-1) + '" fill="' + c + '"/>';
  return s + '</svg>';
}

// ---------- page scaffold ----------
function idx(){ for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === C.id) return i; return -1; }
function pageNav(cls){
  var i = idx(), p = i > 0 ? PAGES[i-1] : null, n = (i >= 0 && i < PAGES.length - 1) ? PAGES[i+1] : null;
  return '<nav class="pagenav ' + cls + '" aria-label="Timelines">' +
    '<span>' + (p ? '<a href="' + p.id + '.html">← ' + esc(p.t) + '</a>' : '<a href="../">← All materials</a>') + '</span>' +
    '<span>' + (n ? '<a href="' + n.id + '.html">' + esc(n.t) + ' →</a>' : '<a href="../">All materials →</a>') + '</span></nav>';
}
var kindsPresent = Object.keys(KINDS).filter(function(k){ return ALL.some(function(e){ return e.kind === k; }); });
var marksPresent = Object.keys(MARKS).filter(function(m){ return ALL.some(function(e){ return e.mark === m; }); });

var app = $("app");
app.innerHTML =
  pageNav("top") +
  '<header><p class="kicker"><a href="../">The Eden Hypothesis</a> · Timelines</p>' +
  '<h1>' + esc(C.title) + '</h1><p class="lede">' + rich(C.lede) + '</p></header>' +
  '<div class="controls"><div class="group" id="views" role="group" aria-label="Zoom to"><span class="group-label">View</span></div>' +
  '<div class="group" id="kinds" role="group" aria-label="Filter by kind"><span class="group-label">Show</span></div></div>' +
  (marksPresent.length ? '<div class="legend">' + '<span>' + markerSVG(null) + ' Dated event or range</span>' +
    marksPresent.map(function(m){ return '<span>' + markerSVG(null, m) + ' ' + MARKS[m] + '</span>'; }).join("") + '</div>' : '') +
  (PRE.length ? '<section class="panel prelude"><div class="panel-title">' + esc(C.prelude.title) + '</div><svg id="presvg" role="group" aria-label="' + esc(C.prelude.title) + '"></svg></section>' : '') +
  '<section class="panel chart" id="chart"><svg id="svg" role="group" aria-label="Timeline chart"></svg>' +
  '<div class="hint"><span id="rangeLabel"></span><span>Drag to move through time · select a marker for detail</span>' +
  '<span class="zoombtns"><button class="chip icon" id="zoomOut" aria-label="Zoom out">−</button><button class="chip icon" id="zoomIn" aria-label="Zoom in">+</button></span></div></section>' +
  '<section class="detail" id="detail" aria-live="polite"></section>' +
  '<h3 class="list-h">All entries</h3><ol class="list" id="list"></ol>' +
  '<footer>' + (C.notes || []).map(function(n){ return '<p>' + rich(n) + '</p>'; }).join("") +
  '<p>Dates follow the book’s notation: BC, with no year zero. Radiocarbon “years ago” are counted from AD 1950 and rounded. A century or millennium spans its full bounds (the nineteenth century BC runs 1900–1801 BC). Mesopotamian dates follow the middle chronology; Egyptian dates follow the high chronology of Peter A. Clayton, <i>Chronicle of the Pharaohs</i> (London: Thames and Hudson, 1994).</p>' +
  (C.noBands ? '' : '<p>Shaded period bands follow approximate conventions for the Levant and Anatolia; regional boundaries vary by a century or more.' + (C.egypt ? ' The second band gives Clayton’s periods for Egypt.' : '') + '</p>') + '</footer>' +
  pageNav("bottom");

var svg = $("svg");

// ---------- layout ----------
function scaleFor(d, W){
  var k = (W - 2*PAD) / (d[1] - d[0]);
  return function(y){ return PAD + (y - d[0]) * k; };
}
function labelX(x0, lw, W){ return Math.max(Math.min(x0 - 4, W - PAD - lw - 2), PAD + 2); }
function packLanes(evs, sx, W){
  var lanes = [], map = {};
  evs.slice().sort(function(a,b){ return a.s - b.s || b.e - a.e; }).forEach(function(e){
    var x0 = sx(e.s), x1 = sx(e.e);
    if (x1 < -40 || x0 > W + 40) return;
    var lw = textW(e.label), lx = labelX(x0, lw, W);
    var occS = Math.min(x0, lx) - 4, occE = Math.max(x1, lx + lw + 4) + 14;
    var i = 0; while (i < lanes.length && lanes[i] > occS) i++;
    lanes[i] = occE; map[e.id] = i;
  });
  return {map:map, n:Math.max(lanes.length, 1), heads:[]};
}
function groupLanes(){
  var map = {}, heads = [], row = 0;
  GROUPS.forEach(function(g, gi){
    var evs = g.events.filter(shown);
    if (!evs.length) return;
    heads.push({row:row, name:g.name}); row += 0.6;
    evs.forEach(function(e){ map[e.id] = row; row += 1; });
    row += 0.2;
  });
  return {map:map, n:Math.max(row, 1), heads:heads};
}
function computeLanes(d, W){ return GROUPS ? groupLanes() : packLanes(EVENTS.filter(shown), scaleFor(d, W), W); }
function niceStep(span, W){
  var target = span / Math.max(2, Math.floor((W - 2*PAD) / 95));
  var p = Math.pow(10, Math.floor(Math.log10(target))), m = target / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

// ---------- drawing ----------
function drawPoint(ev, cx, cy, e, c){
  if (e.mark === "book") mk("path", {d:"M"+cx+" "+(cy-7)+"L"+(cx+7)+" "+cy+"L"+cx+" "+(cy+7)+"L"+(cx-7)+" "+cy+"Z", fill:c, stroke:"var(--surface)", "stroke-width":1.5}, ev);
  else if (e.mark === "claim") mk("circle", {cx:cx, cy:cy, r:5.5, fill:"var(--surface)", stroke:c, "stroke-width":2.2}, ev);
  else if (e.mark === "hist") mk("circle", {cx:cx, cy:cy, r:5.5, fill:"var(--surface)", stroke:c, "stroke-width":2, "stroke-dasharray":"2.5 2"}, ev);
  else mk("circle", {cx:cx, cy:cy, r:5.5, fill:c}, ev);
}
function drawEvent(g, e, sx, row, W){
  var x0 = sx(e.s), x1 = sx(e.e);
  if (x1 < -200 || x0 > W + 200) return;
  var yTop = TOP + row * ROW, yMark = yTop + 25, c = color(e.kind), isSel = selected === e.id;
  var ev = mk("g", {"class":"ev" + (isSel ? " sel" : ""), tabindex:0, role:"button", "aria-label":e.title + ", " + e.when, "data-id":e.id}, g);
  var lw = textW(e.label), lx = labelX(x0, lw, W);
  mk("rect", {"class":"hit", x:Math.min(x0, lx) - 6, y:yTop + 1, width:Math.max(x1, lx + lw) - Math.min(x0, lx) + 12, height:ROW - 4, rx:4}, ev);
  var span = x1 - x0, cx;
  if (span >= 6){
    var bar = {x:x0, y:yMark - 4, width:span, height:8, rx:4, fill:c, opacity:isSel ? 1 : .8};
    if (e.mark === "claim" || e.mark === "hist"){ bar.fill = "none"; bar.stroke = c; bar["stroke-width"] = 1.6; bar.x = x0 + .8; bar.width = Math.max(0, span - 1.6); if (e.mark === "hist") bar["stroke-dasharray"] = "3 2"; }
    mk("rect", bar, ev);
    if (e.pt !== undefined){ cx = sx(e.pt); drawPoint(ev, cx, yMark, e, c); }
    else if (e.mark === "book"){ cx = x0; drawPoint(ev, cx, yMark, e, c); }
    else cx = x0;
  } else { cx = (x0 + x1) / 2; drawPoint(ev, cx, yMark, e, c); }
  if (isSel) mk("circle", {cx:cx, cy:yMark, r:10.5, fill:"none", stroke:"var(--focus)", "stroke-width":2}, ev);
  var t = mk("text", {x:lx, y:yTop + 14}, ev); t.textContent = e.label;
  mk("title", {}, ev).textContent = e.title + " — " + e.when;
}
function drawBands(g, sx, W, H){
  if (C.noBands) return;
  PERIODS.forEach(function(p, i){
    var a = sx(p[0]), b = sx(p[1]);
    if (b < 0 || a > W) return;
    mk("rect", {x:a, y:0, width:Math.max(0, b - a), height:H, fill:"var(" + (i % 2 ? "--band-b" : "--band-a") + ")", opacity:.55}, g);
    var cl = Math.max(a, PAD), cr = Math.min(b, W - PAD), w = cr - cl, lab = null;
    if (smallW(p[2]) + 12 < w) lab = p[2]; else if (smallW(p[3]) + 8 < w) lab = p[3];
    if (lab){ var t = mk("text", {x:(cl + cr)/2, y:15, "text-anchor":"middle", "class":"band-label"}, g); t.textContent = lab;
      mk("title", {}, t).textContent = p[2] + " (approx. " + fmtYear(p[0]) + "–" + fmtYear(Math.min(p[1], -1)) + ")"; }
  });
}
function drawEgypt(g, sx, W){
  if (!C.egypt) return;
  EGYPT.forEach(function(p, i){
    var a = sx(p[0]), b = sx(p[1]);
    if (b < 0 || a > W) return;
    mk("rect", {x:a + 1, y:24, width:Math.max(0, b - a - 2), height:16, rx:3, fill:"var(--muted)", opacity: i % 2 ? .10 : .18}, g);
    var cl = Math.max(a, PAD), cr = Math.min(b, W - PAD), w = cr - cl, lab = null;
    var full = "Egypt: " + p[2];
    if (smallW(full) + 12 < w) lab = full; else if (smallW(p[2]) + 10 < w) lab = p[2]; else if (smallW(p[3]) + 8 < w) lab = p[3];
    if (lab){ var t = mk("text", {x:(cl + cr)/2, y:36, "text-anchor":"middle", "class":"band-label"}, g); t.textContent = lab;
      mk("title", {}, t).textContent = "Egypt, " + p[2] + " Period, " + fmtYear(p[0]) + "–" + fmtYear(Math.min(p[1], -1)) + " (Clayton)"; }
  });
}
function render(d, lanes){
  var W = svg.clientWidth || svg.parentNode.clientWidth;
  var sx = scaleFor(d, W);
  lanes = lanes || computeLanes(d, W);
  var H = TOP + lanes.n * ROW + AXIS_H;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("height", H);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  var cp = mk("clipPath", {id:"clip"}, mk("defs", {}, svg));
  mk("rect", {x:PAD - 2, y:0, width:W - 2*PAD + 4, height:H}, cp);
  var g = mk("g", {"clip-path":"url(#clip)"}, svg);
  drawBands(g, sx, W, H - AXIS_H);
  drawEgypt(g, sx, W);
  var axisY = H - AXIS_H, step = niceStep(d[1] - d[0], W);
  mk("line", {x1:PAD, x2:W - PAD, y1:axisY, y2:axisY, stroke:"var(--muted)", "stroke-width":1}, svg);
  for (var y = Math.ceil(d[0]/step)*step; y <= d[1]; y += step){
    var x = sx(y); if (x < PAD - 1 || x > W - PAD + 1) continue;
    var tg = mk("g", {"class":"tick"}, g);
    mk("line", {x1:x, x2:x, y1:BAND_H, y2:axisY + 5, "stroke-dasharray":"2 4"}, tg);
    if (Math.round(y) !== 0){
      mk("text", {x:x, y:axisY + 19, "text-anchor": x < PAD + 30 ? "start" : (x > W - PAD - 30 ? "end" : "middle")}, tg).textContent = fmtYear(y);
    }
  }
  lanes.heads.forEach(function(h){
    var t = mk("text", {x:PAD + 4, y:TOP + h.row * ROW + 17, "class":"group-head"}, g); t.textContent = h.name;
  });
  EVENTS.filter(shown).forEach(function(e){ if (e.id in lanes.map) drawEvent(g, e, sx, lanes.map[e.id], W); });
  $("rangeLabel").textContent = fmtYear(d[0]) + " to " + fmtYear(d[1]);
}
function renderPrelude(){
  if (!PRE.length) return;
  var ps = $("presvg"), W = ps.clientWidth || ps.parentNode.clientWidth;
  var lo = Math.log10(C.prelude.min), hi = Math.log10(C.prelude.max);
  var ago = function(y){ return 1950 - y; };
  var sx = function(y){ return PAD + (hi - Math.log10(ago(y))) / (hi - lo) * (W - 2*PAD); };
  var evs = PRE.filter(shown), lanes = packLanes(evs, sx, W);
  var H = 14 + lanes.n * ROW + AXIS_H;
  ps.setAttribute("viewBox", "0 0 " + W + " " + H); ps.setAttribute("height", H);
  while (ps.firstChild) ps.removeChild(ps.firstChild);
  var axisY = H - AXIS_H;
  mk("line", {x1:PAD, x2:W - PAD, y1:axisY, y2:axisY, stroke:"var(--muted)", "stroke-width":1}, ps);
  C.prelude.ticks.forEach(function(v){
    var x = sx(1950 - v), tg = mk("g", {"class":"tick"}, ps);
    mk("line", {x1:x, x2:x, y1:0, y2:axisY + 5, "stroke-dasharray":"2 4"}, tg);
    var lab = v >= 1e6 ? (v/1e6) + " million" : v.toLocaleString("en-US");
    mk("text", {x:x, y:axisY + 19, "text-anchor": x < PAD + 40 ? "start" : (x > W - PAD - 40 ? "end" : "middle")}, tg).textContent = lab;
  });
  var t = mk("text", {x:W - PAD, y:axisY - 6, "text-anchor":"end", "class":"band-label"}, ps); t.textContent = "years ago (log scale) →";
  var save = TOP; TOP = 6;
  evs.forEach(function(e){ if (e.id in lanes.map) drawEvent(ps, e, sx, lanes.map[e.id], W); });
  TOP = save;
}

// ---------- motion ----------
function ease(t){ return t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2; }
function clampDomain(d){
  var L = C.limits, span = Math.max(MIN_SPAN, Math.min(d[1] - d[0], L[1] - L[0]));
  var a = d[0], b = a + span;
  if (a < L[0]){ a = L[0]; b = a + span; }
  if (b > L[1]){ b = L[1]; a = b - span; }
  return [a, b];
}
function animateTo(target){
  target = clampDomain(target);
  if (anim) cancelAnimationFrame(anim);
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = svg.clientWidth || svg.parentNode.clientWidth;
  var lanes = computeLanes(target, W);
  if (!GROUPS){
    var union = computeLanes([Math.min(domain[0], target[0]), Math.max(domain[1], target[1])], W);
    EVENTS.filter(shown).forEach(function(e){ if (!(e.id in lanes.map)) lanes.map[e.id] = Math.min(union.map[e.id] || 0, lanes.n - 1); });
  }
  var from = domain.slice(), t0 = performance.now(), dur = reduce ? 0 : 520;
  function frame(now){
    var p = dur ? Math.min(1, (now - t0)/dur) : 1, k = ease(p);
    domain = [from[0] + (target[0] - from[0])*k, from[1] + (target[1] - from[1])*k];
    render(domain, p < 1 ? lanes : null);
    anim = p < 1 ? requestAnimationFrame(frame) : null;
  }
  anim = requestAnimationFrame(frame);
}
function setView(i){
  document.querySelectorAll("#views .chip").forEach(function(b, j){ b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
  if (i >= 0) animateTo(C.views[i].d.slice());
}

// ---------- controls ----------
C.views.forEach(function(v, i){
  var b = document.createElement("button");
  b.className = "chip"; b.textContent = v.name; b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
  b.addEventListener("click", function(){ setView(i); });
  $("views").appendChild(b);
});
kindsPresent.forEach(function(k){
  var n = ALL.filter(function(e){ return e.kind === k; }).length;
  var b = document.createElement("button");
  b.className = "chip kind"; b.setAttribute("aria-pressed", "true");
  b.innerHTML = '<span class="dot" style="background:' + color(k) + '"></span>' + KINDS[k].name + ' <span style="color:var(--muted)">' + n + '</span>';
  b.addEventListener("click", function(){
    hidden[k] = !hidden[k];
    b.setAttribute("aria-pressed", hidden[k] ? "false" : "true");
    var s = byId(selected); if (s && hidden[s.kind]) selected = null;
    render(domain); renderPrelude(); buildList(); showDetail();
  });
  $("kinds").appendChild(b);
});
function zoomBy(f){
  var c = (domain[0] + domain[1]) / 2, h = (domain[1] - domain[0]) * f / 2;
  setView(-1); animateTo([c - h, c + h]);
}
$("zoomIn").addEventListener("click", function(){ zoomBy(0.5); });
$("zoomOut").addEventListener("click", function(){ zoomBy(2); });

var drag = null;
svg.addEventListener("pointerdown", function(ev){ if (ev.button === 0) drag = {x:ev.clientX, d:domain.slice(), moved:false, id:ev.pointerId}; });
svg.addEventListener("pointermove", function(ev){
  if (!drag) return;
  var dx = ev.clientX - drag.x;
  if (!drag.moved && Math.abs(dx) < 4) return;
  if (!drag.moved){ drag.moved = true; svg.setPointerCapture(drag.id); svg.classList.add("dragging"); if (anim){ cancelAnimationFrame(anim); anim = null; } }
  var per = (drag.d[1] - drag.d[0]) / (svg.clientWidth - 2*PAD);
  domain = clampDomain([drag.d[0] - dx*per, drag.d[1] - dx*per]);
  render(domain);
});
function clickTarget(ev){ var t = ev.target.closest ? ev.target.closest(".ev") : null; return t ? +t.getAttribute("data-id") : null; }
svg.addEventListener("pointerup", function(ev){
  if (!drag) return;
  var moved = drag.moved; drag = null; svg.classList.remove("dragging");
  if (moved){ setView(-1); return; }
  var id = clickTarget(ev); if (id) select(id, false);
});
svg.addEventListener("pointercancel", function(){ drag = null; svg.classList.remove("dragging"); });
function keySelect(ev){ var id = clickTarget(ev); if (id && (ev.key === "Enter" || ev.key === " ")){ ev.preventDefault(); select(id, false); } }
svg.addEventListener("keydown", keySelect);
if (PRE.length){
  $("presvg").addEventListener("click", function(ev){ var id = clickTarget(ev); if (id) select(id, false); });
  $("presvg").addEventListener("keydown", keySelect);
}

// ---------- selection, detail, list ----------
function ordered(){
  if (GROUPS) return EVENTS.filter(shown);
  var key = function(e){ return e.pt !== undefined ? e.pt : e.s; };
  return PRE.filter(shown).concat(EVENTS.filter(shown).sort(function(a,b){ return key(a) - key(b) || a.e - b.e || a.id - b.id; }));
}
function select(id, reveal){
  selected = id;
  var e = byId(id);
  if (reveal && e && !e.pre){
    var span = domain[1] - domain[0], need = (e.e - e.s) * 1.5;
    var inView = e.s >= domain[0] + span*0.04 && e.e <= domain[1] - span*0.25;
    if (!inView || need > span){
      var s2 = Math.max(span, need), c = (e.s + e.e)/2;
      setView(-1); animateTo([c - s2*0.4, c + s2*0.6]);
    } else render(domain);
  } else render(domain);
  renderPrelude(); showDetail(); buildList();
  if (reveal) (e && e.pre ? document.querySelector(".prelude") : $("chart")).scrollIntoView({behavior:"smooth", block:"nearest"});
}
function showDetail(){
  var box = $("detail"), e = byId(selected);
  if (!e){
    box.style.removeProperty("--kc");
    box.innerHTML = '<p class="empty">Select a marker on the timeline or an entry below to read its context.</p>';
    return;
  }
  var list = ordered(), i = list.indexOf(e);
  box.style.setProperty("--kc", color(e.kind));
  box.innerHTML =
    '<div class="meta"><span class="kind-name">' + KINDS[e.kind].name + '</span>' +
    (e.mark ? '<span class="tag">' + MARKS[e.mark] + '</span>' : '') +
    (GROUPS ? '<span>' + esc(GROUPS[e.group].name) + '</span>' : '') + '</div>' +
    '<h2>' + rich(e.title) + '</h2>' +
    '<p class="when">' + esc(e.when) + '</p>' +
    (e.written ? '<p class="written">In the text: “' + esc(e.written) + '”</p>' : '') +
    '<p class="ctx">' + rich(e.ctx) + '</p>' +
    (e.refs ? '<p class="refs">Discussed in ' + esc(e.refs) + '</p>' : '') +
    '<div class="nav"><button class="chip" id="prev"' + (i <= 0 ? " disabled" : "") + '>← Earlier</button>' +
    '<button class="chip" id="next"' + (i >= list.length - 1 ? " disabled" : "") + '>Later →</button></div>';
  if (i > 0) $("prev").addEventListener("click", function(){ select(list[i-1].id, true); });
  if (i < list.length - 1) $("next").addEventListener("click", function(){ select(list[i+1].id, true); });
}
function buildList(){
  var ol = $("list"), lastGroup = -1;
  ol.innerHTML = "";
  ordered().forEach(function(e){
    if (GROUPS && e.group !== lastGroup){
      lastGroup = e.group;
      var gh = document.createElement("li"); gh.className = "group-row"; gh.textContent = GROUPS[e.group].name; ol.appendChild(gh);
    }
    var li = document.createElement("li"); if (e.id === selected) li.className = "sel";
    var b = document.createElement("button");
    b.innerHTML = '<span class="l-date">' + markerSVG(e.kind, e.mark, 11) + esc(e.short || e.when) + '</span><span class="l-title">' + rich(e.title) + '</span>';
    b.addEventListener("click", function(){ select(e.id, true); });
    li.appendChild(b); ol.appendChild(li);
  });
}
document.addEventListener("keydown", function(ev){
  if (selected === null || /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
  var list = ordered(), i = list.indexOf(byId(selected));
  if (ev.key === "ArrowRight" && i < list.length - 1){ ev.preventDefault(); select(list[i+1].id, true); }
  if (ev.key === "ArrowLeft" && i > 0){ ev.preventDefault(); select(list[i-1].id, true); }
});
var rT; window.addEventListener("resize", function(){ clearTimeout(rT); rT = setTimeout(function(){ render(domain); renderPrelude(); }, 80); });

render(domain); renderPrelude(); buildList(); showDetail();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ render(domain); renderPrelude(); });
})();
