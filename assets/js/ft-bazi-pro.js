/*!
 * Fate Tutor — BaZi professional chart (专业排盘), part of the bazi/ page.
 *
 * Three views share one detail panel and one luck → year → month timeline:
 *   Chart 命盘 · Relations wheel 刑冲合会 · Five elements & Ten Gods 五行十神.
 * Every fact comes from the Rust engine (the reading, plus the "pillar",
 * "relations" and "flow_months" commands); this file only lays them out.
 * All text goes in with textContent.
 */
(function (w, d) {
  "use strict";

  const GAN = "甲乙丙丁戊己庚辛壬癸";
  const ZHI = "子丑寅卯辰巳午未申酉戌亥";
  const ORDER = ["wood", "fire", "earth", "metal", "water"];
  const COL = { wood: "#5fd4a0", fire: "#ff8a6b", earth: "#e9c349", metal: "#cbd5e1", water: "#7bd0ff" };
  const REL_COLOR = { stem_he: "#44e2cd", stem_chong: "#ff8a6b", liu_he: "#44e2cd", liu_chong: "#ff8a6b", san_he: "#93d7ff",
    ban_he: "#93d7ff", san_hui: "#e9c349", xing: "#c084fc", zi_xing: "#c084fc", liu_hai: "#f472b6", liu_po: "#94a3b8" };
  const REL_KINDS = ["liu_he", "liu_chong", "san_he", "ban_he", "san_hui", "stem_he", "stem_chong", "xing", "zi_xing", "liu_hai", "liu_po"];
  const KEYS = ["year", "month", "day", "hour"];
  const SVG = "http://www.w3.org/2000/svg";

  const st = {
    tab: "grid", luck: null, year: null, month: null, months: null, monthsFor: null, sel: null,
    relOn: { liu_he: true, liu_chong: true, san_he: true, ban_he: true, san_hui: true, stem_he: true, stem_chong: true, xing: false, zi_xing: false, liu_hai: false, liu_po: false },
    hidden: true, lastInput: null, cache: {},
  };
  let api = null, rec = null;
  const $ = (id) => d.getElementById(id);
  const t = (k, p) => api.t(k, p);
  const zh = () => api.lang === "zh-hans" || api.lang === "zh-hant";

  function sv(tag, attrs, kids) {
    const n = d.createElementNS(SVG, tag);
    for (const k in attrs || {}) { if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    [].concat(kids || []).forEach((c) => c && n.appendChild(c));
    return n;
  }
  const el = (tag, attrs, kids) => api.el(tag, attrs, kids);
  const godName = (code) => (code ? t("tengod." + code) : "");
  // Short Ten God label for tight cells: the Chinese name in the reader's script.
  const godShort = (code, zhSimplified) => {
    if (!code) return "";
    if (api.lang === "zh-hans" || api.lang === "zh-hant") return t("tengod." + code).replace(/\s*\(.*\)/, "");
    const m = t("tengod." + code).match(/\(([^)]+)\)/);
    return m ? m[1] : zhSimplified;
  };
  const QI_SHORT = () => (api.lang === "zh-hant" ? ["本", "中", "餘"] : ["本", "中", "余"]);
  const stageName = (code, zhName) => (zh() ? t("pg.bazi.pro.stage." + code) : t("pg.bazi.pro.stage." + code) + " " + zhName);
  const nayinName = (cycle, zhName) => (zh() ? t("pg.bazi.pro.nayin." + Math.floor(cycle / 2)) : zhName + " · " + t("pg.bazi.pro.nayin." + Math.floor(cycle / 2)));

  // ------------------------------------------------------------ engine helpers (cached)
  function call(req) {
    const key = JSON.stringify(req);
    if (!(key in st.cache)) {
      try { st.cache[key] = api.engine.call(req); } catch (e) { st.cache[key] = null; }
    }
    return st.cache[key];
  }
  const dayStem = () => rec.bazi.day.stem;
  const pillarFacts = (stem, branch) => call({ cmd: "pillar", stem: stem, branch: branch, day_stem: dayStem() });

  // ------------------------------------------------------------ columns
  function columns() {
    const b = rec.bazi;
    const cols = KEYS.map((k) => ({ key: k, label: t("pg.bazi.pro.col." + k), p: b[k], natal: true }));
    const add = (key, label, stem, branch, extra) => {
      const p = pillarFacts(stem, branch);
      if (p) cols.push(Object.assign({ key: key, label: label, p: p, natal: false }, extra || {}));
    };
    const L = b.luck && st.luck !== null ? b.luck.pillars[st.luck] : null;
    if (L) add("luck", t("pg.bazi.pro.col.luck") + " " + L.start_year, L.stem, L.branch);
    const Y = L && st.year !== null ? L.years[st.year] : null;
    if (Y) add("flow_year", t("pg.bazi.pro.col.flow_year") + " " + Y.year, Y.stem, Y.branch);
    const M = Y && st.months && st.month !== null ? st.months[st.month] : null;
    if (M) add("flow_month", t("pg.bazi.pro.col.flow_month") + " " + M.month, M.stem, M.branch);
    return cols;
  }

  // Short column name for the wheel and lists: drops the Chinese word in non-Chinese
  // languages but keeps the year or month number, so 'Year' (birth) and 'Year 1996' differ.
  const short = (c) => (c.natal ? c.label.split(' ')[0] : c.label.split(' ').filter((w) => !/[\u3400-\u9fff]/.test(w) || zh()).join(' '));

  // ------------------------------------------------------------ the detail panel
  function explain(kind, title, lines) {
    const box = $("pro-explain");
    box.textContent = "";
    box.appendChild(el("span", { class: "k", text: t("pg.bazi.pro.ex." + kind + ".title") }));
    if (title) box.appendChild(el("h3", { text: title }));
    (lines || []).forEach((l) => l && box.appendChild(el("p", { class: "fact-line", text: l })));
    box.appendChild(el("p", { text: t("pg.bazi.pro.ex." + kind + ".what") }));
    box.appendChild(el("p", { class: "how", text: t("pg.bazi.pro.ex.how") + ": " + t("pg.bazi.pro.ex." + kind + ".how") }));
    box.appendChild(el("p", { class: "src", text: t("pg.bazi.pro.ex.source") + ": " + t("pg.bazi.pro.ex." + kind + ".src") + " · " + t("pg.bazi.pro.ex.review") }));
  }

  // ------------------------------------------------------------ header line
  function drawHead() {
    const r = rec, b = r.bazi, host = $("pro-head");
    host.textContent = "";
    const item = (label, value, kind) => {
      const s = el("button", { type: "button", class: "ph" }, [label + ": ", el("b", { text: value })]);
      if (kind) s.addEventListener("click", () => explain(kind, label + ": " + value));
      host.appendChild(s);
    };
    item(t("pg.bazi.pro.head.solar"), api.formatDate(r.input.date) + (r.input.time ? ", " + r.input.time : "") + (r.input.place ? " · " + r.input.place : ""));
    item(t("pg.bazi.pro.head.lunar"), t("result.lunar.value", { year: r.lunar.year_stem_branch + " " + r.lunar.year, leap: r.lunar.is_leap ? t("result.lunar.leap") : "", month: r.lunar.month, day: r.lunar.day }));
    if (r.time && r.time.true_solar_time) item(t("pg.bazi.pro.head.sun"), r.time.true_solar_time.slice(11, 16));
    item(t("pg.bazi.pro.head.terms"), t("pg.bazi.pro.head.terms.value", {
      open: b.month_opened_by.name_zh, open_time: b.month_opened_by.beijing.slice(0, 16).replace("T", " "),
      close: b.month_closes_at.name_zh, close_time: b.month_closes_at.beijing.slice(0, 16).replace("T", " "),
    }), "branch");
    const pal = (x) => (x ? x.name_zh + " " + (zh() ? t("pg.bazi.pro.nayin." + Math.floor(nCycle(x) / 2)) : x.nayin) : t("pg.bazi.pro.head.needs_time"));
    item(t("pg.bazi.pro.head.ming"), pal(b.ming_gong), "palaces");
    item(t("pg.bazi.pro.head.shen"), pal(b.shen_gong), "palaces");
    item(t("pg.bazi.pro.head.tai"), pal(b.tai_yuan), "palaces");
  }
  const nCycle = (x) => { for (let n = 0; n < 60; n++) if (n % 10 === x.stem && n % 12 === x.branch) return n; return 0; };

  // ------------------------------------------------------------ chart grid
  function drawGrid() {
    const cols = columns();
    const table = $("pro-grid");
    table.textContent = "";
    const head = el("tr", null, [el("th", { class: "row" })].concat(cols.map((c) =>
      el("th", { class: "c-" + c.key + (c.key === "day" ? " dm" : "") + (c.natal ? "" : " extra"), text: c.label }))));
    table.appendChild(el("thead", null, head));
    const body = el("tbody");
    const stars = {};
    (rec.bazi.stars || []).forEach((s) => { (stars[s.pillar] = stars[s.pillar] || []).push(s); });
    const row = (rowKey, kind, cell) => {
      const tr = el("tr", null, [el("th", { class: "row", text: t("pg.bazi.pro.row." + rowKey) })]);
      cols.forEach((c, i) => {
        const content = c.p ? cell(c, i) : (rowKey === "stem" ? el("span", { class: "dim", text: t("pg.bazi.pro.hour_unknown") }) : "—");
        const td = el("td", { class: "c-" + c.key + (c.natal ? "" : " extra") }, [content]);
        td.addEventListener("click", () => {
          if (st.sel) st.sel.classList.remove("sel");
          td.classList.add("sel"); st.sel = td;
          const extra = rowKey === "stars" && c.natal && stars[i]
            ? stars[i].map((s) => t("pg.bazi.pro.star." + s.code) + " (" + t("pg.bazi.pro.star.from." + s.from) + ")").join(" · ")
            : rowKey === "hidden" && c.p ? c.p.hidden.map((h, k) => h.stem_zh + " " + godName(h.ten_god) + " · " + t("pg.bazi.pro.qi." + k)).join("; ")
            : td.innerText.replace(/\s*\n\s*/g, " · ");
          explain(kind, c.label, [extra]);
        });
        tr.appendChild(td);
      });
      body.appendChild(tr);
    };
    row("god", "god", (c) => el("span", { class: "god" + (c.key === "day" ? " dm" : ""), text: c.key === "day" ? t("pg.bazi.pro.day_master") : godName(c.p.ten_god).replace(" (", "\n(") }));
    row("stem", "stem", (c) => el("span", { class: "big el-" + c.p.stem_element, text: c.p.stem_zh }));
    row("branch", "branch", (c) => el("span", { class: "big el-" + c.p.branch_element, text: c.p.branch_zh }));
    // Compact cells: Chinese short forms in the table, the full names in the detail panel.
    row("hidden", "hidden", (c) => el("div", { class: "hid", title: c.p.hidden.map((h, i) => h.stem_zh + " " + godName(h.ten_god) + " · " + t("pg.bazi.pro.qi." + i)).join("\n") },
      c.p.hidden.map((h, i) => el("span", null, [el("b", { class: "el-" + h.element, text: h.stem_zh }), " " + godShort(h.ten_god, h.ten_god_zh) + " ", el("i", { text: QI_SHORT()[i] })]))));
    row("nayin", "nayin", (c) => el("div", { class: "nay" }, [
      el("span", { class: "el-" + c.p.pro.nayin_element, text: zh() ? t("pg.bazi.pro.nayin." + Math.floor(c.p.cycle_index / 2)) : c.p.pro.nayin }),
      zh() ? null : el("small", { text: t("pg.bazi.pro.nayin." + Math.floor(c.p.cycle_index / 2)) }),
    ]));
    row("stage", "stage", (c) => stageName(c.p.pro.stage, c.p.pro.stage_zh));
    row("self", "self", (c) => stageName(c.p.pro.self_stage, c.p.pro.self_stage_zh));
    row("xunkong", "xunkong", (c) => c.p.pro.xunkong_zh);
    row("stars", "stars", (c, i) => (c.natal && stars[i] ? el("div", { class: "stars" }, stars[i].map((s) =>
      el("span", { class: "starchip", title: t("pg.bazi.pro.star." + s.code) + " · " + t("pg.bazi.pro.star.from." + s.from) },
        t("pg.bazi.pro.star." + s.code).split(" ").pop()))) : t("pg.bazi.pro.star.none")));
    row("palace", "palace", (c) => (c.natal ? t("pg.bazi.pro.palace." + c.key) : "—"));
    table.appendChild(body);
  }

  // ------------------------------------------------------------ relations wheel
  function drawWheel() {
    const host = $("pro-wheel");
    host.textContent = "";
    const cols = columns().filter((c) => c.p);
    const rels = call({ cmd: "relations", pillars: cols.map((c) => [c.p.stem, c.p.branch]) }) || [];
    const W = 620, cx = 310, cy = 300, R = 220, r2 = 120;
    const s = sv("svg", { viewBox: "0 0 " + W + " 600", class: "wheel-svg", role: "img", "aria-label": t("pg.bazi.pro.tab.wheel") });
    const pos = (i, r) => { const a = (-90 + i * 30) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    s.appendChild(sv("circle", { cx: cx, cy: cy, r: R + 28, fill: "none", stroke: "rgba(212,175,55,.22)" }));
    const used = {};
    cols.forEach((c) => { (used[c.p.branch] = used[c.p.branch] || []).push(short(c)); });
    for (let i = 0; i < 12; i++) {
      const [x, y] = pos(i, R), lit = !!used[i];
      const el2 = ["water", "earth", "wood", "wood", "earth", "fire", "fire", "earth", "metal", "metal", "earth", "water"][i];
      s.appendChild(sv("circle", { cx: x, cy: y, r: 25, fill: lit ? COL[el2] + "33" : "rgba(255,255,255,.03)", stroke: lit ? COL[el2] : "rgba(255,255,255,.14)", "stroke-width": lit ? 2 : 1 }));
      s.appendChild(sv("text", { x: x, y: y + 8, "text-anchor": "middle", class: "w-zhi", fill: lit ? COL[el2] : "#6b7280", text: ZHI[i] }));
      if (lit) { const [lx, ly] = pos(i, R + 48); s.appendChild(sv("text", { x: lx, y: ly + 4, "text-anchor": "middle", class: "w-lab", text: used[i].join(" · ") })); }
    }
    const stemPos = (k) => { const a = (-90 + 360 * k / cols.length + 180 / cols.length) * Math.PI / 180; return [cx + r2 * Math.cos(a), cy + r2 * Math.sin(a)]; };
    cols.forEach((c, k) => {
      const [x, y] = stemPos(k);
      s.appendChild(sv("text", { x: x, y: y + 7, "text-anchor": "middle", class: "w-gan", fill: COL[c.p.stem_element], text: c.p.stem_zh }));
      s.appendChild(sv("text", { x: x, y: y + 24, "text-anchor": "middle", class: "w-lab", text: short(c) }));
    });
    const list = $("pro-rellist");
    list.textContent = "";
    rels.forEach((rel) => {
      if (!st.relOn[rel.kind]) return;
      const color = REL_COLOR[rel.kind];
      const stem = rel.kind.indexOf("stem_") === 0;
      const pts = rel.members.map((m) => (stem ? stemPos(m) : pos(cols[m].p.branch, R - 27)));
      const line = sv(pts.length > 2 ? "polygon" : "line", pts.length > 2
        ? { points: pts.map((p) => p.join(",")).join(" "), fill: color + "18", stroke: color, "stroke-width": 2.5, class: "rel" }
        : { x1: pts[0][0], y1: pts[0][1], x2: pts[1][0], y2: pts[1][1], stroke: color, "stroke-width": 2.5, "stroke-dasharray": stem ? "6 4" : "", class: "rel" });
      const say = t("pg.bazi.pro.rel." + rel.kind) + ": " + rel.chars + (rel.element ? " (" + api.elementName(rel.element) + ")" : "") + " — " +
        t("pg.bazi.pro.rel.between", { list: rel.members.map((m) => short(cols[m])).join(" · ") });
      line.addEventListener("click", () => explain("rel", say));
      s.appendChild(line);
      const li = el("button", { type: "button", class: "relrow" }, [el("i", { style: "background:" + color }), say]);
      li.addEventListener("click", () => explain("rel", say));
      list.appendChild(li);
    });
    if (!list.children.length) list.appendChild(el("p", { class: "dim", text: t("pg.bazi.pro.rel.none") }));
    host.appendChild(s);
  }

  function drawRelToggles() {
    const host = $("pro-reltoggles");
    host.textContent = "";
    REL_KINDS.forEach((k) => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = st.relOn[k];
      cb.addEventListener("change", () => { st.relOn[k] = cb.checked; drawWheel(); });
      host.appendChild(el("label", { class: "tog" }, [cb, el("i", { style: "background:" + REL_COLOR[k] }), t("pg.bazi.pro.rel." + k)]));
    });
  }

  // ------------------------------------------------------------ five elements & ten gods star
  function drawStar() {
    const host = $("pro-star");
    host.textContent = "";
    const b = rec.bazi, dm = b.day_master;
    const k0 = ORDER.indexOf(dm.element);
    const group = (e) => t("pg.bazi.pro.group." + ((ORDER.indexOf(e) - k0 + 5) % 5));
    const count = {}, items = {};
    ORDER.forEach((e) => { count[e] = 0; items[e] = []; });
    KEYS.forEach((k) => {
      const p = b[k];
      if (!p) return;
      const label = t("pg.bazi.pro.col." + k).split(" ")[0];
      count[p.stem_element] += 1; items[p.stem_element].push(p.stem_zh + " (" + label + ")");
      if (!st.hidden) { count[p.branch_element] += 1; items[p.branch_element].push(p.branch_zh + " (" + label + ")"); }
      else p.hidden.forEach((h, i) => { const wgt = p.pro.element_hidden_weights[i]; count[h.element] += wgt; items[h.element].push(h.stem_zh + " ⊂ " + p.branch_zh + " ×" + wgt); });
    });
    const s = sv("svg", { viewBox: "0 0 600 540", class: "star-svg", role: "img", "aria-label": t("pg.bazi.pro.tab.star") });
    s.appendChild(sv("defs", null, [
      sv("marker", { id: "pro-arr", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, [sv("path", { d: "M0,0 L10,5 L0,10 z", fill: "#5fd4a0" })]),
      sv("marker", { id: "pro-arr2", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, [sv("path", { d: "M0,0 L10,5 L0,10 z", fill: "#ff8a6b" })]),
    ]));
    const cx = 300, cy = 285, R = 178;
    const P = ORDER.map((e, i) => { const a = (-90 + i * 72) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
    const cut = (a, b2, dd) => { const dx = b2[0] - a[0], dy = b2[1] - a[1], L = Math.hypot(dx, dy); return [a[0] + dx * dd / L, a[1] + dy * dd / L, b2[0] - dx * dd / L, b2[1] - dy * dd / L]; };
    for (let i = 0; i < 5; i++) {
      const [x1, y1, x2, y2] = cut(P[i], P[(i + 1) % 5], 56);
      s.appendChild(sv("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: "#5fd4a0", "stroke-width": 1.8, "marker-end": "url(#pro-arr)", opacity: 0.85 }));
      const [a1, b1, a2, b2] = cut(P[i], P[(i + 2) % 5], 56);
      s.appendChild(sv("line", { x1: a1, y1: b1, x2: a2, y2: b2, stroke: "#ff8a6b", "stroke-width": 1.4, "stroke-dasharray": "5 4", "marker-end": "url(#pro-arr2)", opacity: 0.75 }));
    }
    const max = Math.max.apply(null, ORDER.map((e) => count[e]).concat([1]));
    ORDER.forEach((e, i) => {
      const [x, y] = P[i], isDm = e === dm.element;
      const rad = 30 + 20 * count[e] / max;
      const g = sv("g", { class: "node", tabindex: "0" });
      g.appendChild(sv("circle", { cx: x, cy: y, r: rad, fill: COL[e] + (isDm ? "44" : "22"), stroke: COL[e], "stroke-width": isDm ? 3 : 1.5 }));
      g.appendChild(sv("text", { x: x, y: y - 3, "text-anchor": "middle", class: "n-el", fill: COL[e], text: api.elementName(e) + " " + "木火土金水"[i] }));
      g.appendChild(sv("text", { x: x, y: y + 17, "text-anchor": "middle", class: "n-ct", text: String(Math.round(count[e] * 10) / 10) }));
      const ang = (-90 + i * 72) * Math.PI / 180;
      g.appendChild(sv("text", { x: cx + (R + rad + 30) * Math.cos(ang), y: cy + (R + rad + 22) * Math.sin(ang) + 4, "text-anchor": "middle", class: "n-grp" + (isDm ? " dm" : ""),
        text: (isDm ? t("pg.bazi.pro.day_master") + " " + dm.stem_zh + " · " : "") + group(e) }));
      const show = () => {
        const box = $("pro-explain");
        box.textContent = "";
        box.appendChild(el("span", { class: "k", text: t("pg.bazi.pro.tab.star") }));
        box.appendChild(el("h3", { text: api.elementName(e) + " — " + group(e) }));
        box.appendChild(el("p", { text: t("pg.bazi.pro.ex.el.what", { dm: dm.stem_zh, dm_el: api.elementName(dm.element), el: api.elementName(e), group: group(e) }) }));
        box.appendChild(el("p", { class: "how", text: items[e].length ? t("pg.bazi.pro.ex.el.items", { list: items[e].join(", ") }) : t("pg.bazi.pro.ex.el.none") }));
        if (st.hidden) box.appendChild(el("p", { class: "src", text: t("pg.bazi.pro.count.note") }));
        box.appendChild(el("p", { class: "src", text: t("pg.bazi.pro.ex.el.note") }));
      };
      g.addEventListener("click", show);
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); show(); } });
      s.appendChild(g);
    });
    s.appendChild(sv("text", { x: cx, y: cy + 4, "text-anchor": "middle", class: "w-lab", text: t("pg.bazi.pro.legend") }));
    host.appendChild(s);
  }

  function drawCountToggles() {
    const host = $("pro-counttoggles");
    host.textContent = "";
    [["hidden", true], ["visible", false]].forEach(([k, v]) => {
      const r = el("input", { type: "radio", name: "pro-count" });
      r.checked = st.hidden === v;
      r.addEventListener("change", () => { st.hidden = v; drawStar(); });
      host.appendChild(el("label", { class: "tog" }, [r, t("pg.bazi.pro.count." + k)]));
    });
  }

  // ------------------------------------------------------------ timeline
  function pickDefaults() {
    const b = rec.bazi;
    st.luck = st.year = st.month = null; st.months = null;
    if (!b.luck) return;
    const now = new Date(), yNow = now.getFullYear();
    const ps = b.luck.pillars;
    let li = ps.findIndex((p, i) => yNow >= p.start_year && (i === ps.length - 1 || yNow < ps[i + 1].start_year));
    if (li < 0) li = yNow < ps[0].start_year ? 0 : ps.length - 1;
    st.luck = li;
    const yi = ps[li].years.findIndex((y) => y.year === yNow);
    st.year = yi >= 0 ? yi : 0;
    loadMonths();
    if (st.months && ps[li].years[st.year].year === yNow) {
      const iso = now.toISOString().slice(0, 16);
      let mi = 0;
      st.months.forEach((m, i) => { if (m.starts_beijing.slice(0, 16) <= iso) mi = i; });
      st.month = mi;
    }
  }

  function loadMonths() {
    const b = rec.bazi;
    const Y = b.luck && st.luck !== null && st.year !== null ? b.luck.pillars[st.luck].years[st.year] : null;
    st.months = Y ? call({ cmd: "flow_months", year: Y.year, day_stem: dayStem() }) : null;
  }

  function chip(cls, top, name, stemEl, branchEl, bottom, on, nowMark) {
    return el("button", { type: "button", class: cls + (on ? " on" : "") + (nowMark ? " now" : "") }, [
      el("small", { text: top }),
      el("b", null, [el("span", { class: "el-" + stemEl, text: name[0] }), el("span", { class: "el-" + branchEl, text: name[1] })]),
      el("small", { text: bottom }),
    ]);
  }
  const elOfStem = (s) => ORDER[Math.floor(s / 2)];
  const elOfBranch = (b) => ["water", "earth", "wood", "wood", "earth", "fire", "fire", "earth", "metal", "metal", "earth", "water"][b];

  function drawTimeline() {
    const b = rec.bazi;
    const lr = $("pro-luck"), yr = $("pro-years"), mr = $("pro-months");
    [lr, yr, mr].forEach((n) => { n.textContent = ""; });
    $("pro-luck-note").textContent = "";
    $("pro-years-title").hidden = $("pro-months-title").hidden = true;
    if (!b.luck) { lr.appendChild(el("p", { class: "dim", text: t("pg.bazi.pro.luck.none") })); return; }
    const yNow = new Date().getFullYear();
    b.luck.pillars.forEach((p, i) => {
      const c = chip("lp", t("pg.bazi.pro.luck.age", { age: p.start_age.toFixed(1) }), p.name_zh, elOfStem(p.stem), elOfBranch(p.branch),
        godName(p.ten_god).replace(/\s*\(.*\)/, "") + " · " + p.start_year, i === st.luck, yNow >= p.start_year && yNow < p.start_year + 10);
      c.addEventListener("click", () => { st.luck = i; st.year = 0; st.month = null; loadMonths(); redraw(); explain("luck", p.name_zh + " · " + p.start_year); });
      lr.appendChild(c);
    });
    $("pro-luck-note").textContent = t("pg.bazi.pro.luck.note", { years: b.luck.start_age_years.toFixed(1) });
    if (st.luck === null) return;
    $("pro-years-title").hidden = false;
    b.luck.pillars[st.luck].years.forEach((y, i) => {
      const c = chip("yp", String(y.year) + (y.year === yNow ? " ●" : ""), y.name_zh, elOfStem(y.stem), elOfBranch(y.branch),
        godName(y.ten_god).replace(/\s*\(.*\)/, ""), i === st.year, false);
      c.addEventListener("click", () => { st.year = i; st.month = null; loadMonths(); redraw(); explain("flow", y.name_zh + " · " + y.year); });
      yr.appendChild(c);
    });
    if (!st.months) return;
    const Y = b.luck.pillars[st.luck].years[st.year];
    const title = $("pro-months-title");
    title.hidden = false;
    title.textContent = t("pg.bazi.pro.months.title", { year: Y.year });
    st.months.forEach((m, i) => {
      const c = chip("mp", t("pg.bazi.pro.months.from", { date: m.starts_beijing.slice(5, 10).replace("-", "/") }), m.name_zh, elOfStem(m.stem), elOfBranch(m.branch),
        godName(m.ten_god).replace(/\s*\(.*\)/, ""), i === st.month, false);
      c.addEventListener("click", () => { st.month = st.month === i ? null : i; redraw(); explain("flow", m.name_zh + " · " + m.starts_beijing.slice(0, 10)); });
      mr.appendChild(c);
    });
  }

  // ------------------------------------------------------------ wiring
  function redraw() {
    drawHead();
    drawGrid();
    drawWheel();
    drawStar();
    drawTimeline();
  }

  function showTab(tab) {
    st.tab = tab;
    d.querySelectorAll("#pro-tabs button").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    ["grid", "wheel", "star"].forEach((k) => { $("pro-view-" + k).hidden = k !== tab; });
  }

  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    d.querySelectorAll("#pro-tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  }

  w.FTBaziPro = {
    draw: function (record, lessonApi) {
      api = lessonApi;
      wire();
      const ready = !!(record && api.engine);
      $("pro-none").hidden = ready;
      $("pro-body").hidden = !ready;
      if (!ready) { rec = null; st.lastInput = null; return; }
      const inputKey = JSON.stringify(record.input) + "|" + api.lang;
      const sameBirth = rec && JSON.stringify(rec.input) === JSON.stringify(record.input);
      rec = record;
      if (!sameBirth) { st.cache = {}; pickDefaults(); }
      if (st.lastInput !== inputKey) {
        st.lastInput = inputKey;
        drawRelToggles();
        drawCountToggles();
        redraw();
        showTab(st.tab);
        const box = $("pro-explain");
        box.textContent = "";
        box.appendChild(el("p", { class: "dim", text: t("pg.bazi.pro.start") }));
      }
    },
  };
})(window, document);
