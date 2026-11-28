/* Fate Tutor 皇極經世 page. The Rust engine places the year in the 元 in this browser; this file
   reads the form, draws the twelve 會, the table and the steps, and shows the book's chronicle
   (site/assets/data/huangji-chronicle.json, built from the saved text by engine/ft_build_huangji.py). */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
  const FIRST = -67016, LAST = 62583;
  let engine, words = {}, language = "en", chronicle = null, assetRoot = "../assets/";
  const t = (key, fallback, params) => {
    let text = words[key] || fallback || key;
    Object.entries(params || {}).forEach(([name, value]) => { text = text.split("{" + name + "}").join(value); });
    return text;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const locale = () => ({ "zh-hans": "zh-CN", "zh-hant": "zh-TW", id: "id-ID", ms: "ms-MY" }[language] || "en-GB");
  const num = (n) => (language.startsWith("zh") ? String(n) : n.toLocaleString(locale()));
  // Astronomical year (1 BC = 0) as a reader's year.
  const yearNum = (n) => (n < 10000 ? String(n) : num(n));       // 2026, but 67,017
  const yearText = (y) => (y <= 0 ? t("pg.huangji.year.bc", "{n} BC", { n: yearNum(1 - y) }) : t("pg.huangji.year.ad", "{n}", { n: yearNum(y) }));
  const span = (a, b) => t("pg.huangji.span", "{a} to {b}", { a: yearText(a), b: yearText(b) });

  function savedBirthYear() {
    let raw = null;
    try { raw = sessionStorage.getItem("ft.birth"); } catch (e) { /* private mode */ }
    if (!raw) { try { if (localStorage.getItem("ft.birth.keep")) raw = localStorage.getItem("ft.birth"); } catch (e) { /* */ } }
    try { const b = raw ? JSON.parse(raw) : null; return b && b.date ? Number(b.date.slice(0, 4)) : null; } catch (e) { return null; }
  }

  function setYear(y) {
    $("hj-era").value = y <= 0 ? "bc" : "ad";
    $("hj-year").value = y <= 0 ? 1 - y : y;
  }

  function readYear() {
    const raw = $("hj-year").value.trim();
    if (!/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    if (n < 1) return null;
    const y = $("hj-era").value === "bc" ? 1 - n : n;
    return y >= FIRST && y <= LAST ? y : null;
  }

  function drawBar(p) {
    const bar = $("hj-bar"); bar.textContent = "";
    const total = LAST - FIRST + 1;
    const pct = (y) => ((y - FIRST) / total) * 100;
    const shade = el("div", "hj-kaiwu");
    shade.style.left = pct(p.kaiwu_first_year) + "%";
    shade.style.width = (pct(p.kaiwu_last_year + 1) - pct(p.kaiwu_first_year)) + "%";
    bar.append(shade);
    for (let h = 1; h <= 12; h += 1) {
      const cell = el("div", "hj-hui" + (h === p.hui.number ? " here" : ""));
      cell.append(el("b", "", BRANCHES[h - 1]), el("span", "", String(h)));
      bar.append(cell);
    }
    const mark = el("div", "hj-mark");
    mark.style.left = pct(p.year + 0.5) + "%";
    bar.append(mark);
    $("hj-bar-note").textContent = t("pg.huangji.bar.kaiwu", "", { a: yearText(p.kaiwu_first_year), b: yearText(p.kaiwu_last_year) });
  }

  function drawTable(p) {
    const body = $("hj-rows"); body.textContent = "";
    const row = (level, here, years) => { const tr = el("tr"); tr.append(el("td", "hj-level", level), el("td", "hj-here", here), el("td", "hj-years", years)); body.append(tr); };
    const of = (s, k, total, up) => t("pg.huangji.here.of", "", { label: s.label.replace(/\d+$/, ""), n: s.number, k, of: total, up });
    row(t("pg.huangji.row.yuan"), t("pg.huangji.here.yuan"), span(p.yuan_first_year, p.yuan_last_year));
    row(t("pg.huangji.row.hui"), of(p.hui, p.hui.number, 12, "元"), span(p.hui.first_year, p.hui.last_year));
    row(t("pg.huangji.row.yun"), of(p.yun, p.yun_in_hui, 30, "會"), span(p.yun.first_year, p.yun.last_year));
    row(t("pg.huangji.row.shi"), of(p.shi, p.shi_in_yun, 12, "運"), span(p.shi.first_year, p.shi.last_year));
    row(t("pg.huangji.row.year"), t("pg.huangji.here.year", "", { gz: p.year_gz, k: p.year_in_shi, i: num(p.index) }), yearText(p.year));
  }

  function drawSteps(p) {
    const out = $("hj-steps"); out.textContent = "";
    const add = (text) => out.append(el("li", "", text));
    add(t("pg.huangji.step.index", "", { year: yearText(p.year), i: num(p.index) }));
    add(t("pg.huangji.step.shi", "", { i: num(p.index), s: p.shi.number, sl: p.shi.label.replace(/\d+$/, ""), k: p.year_in_shi }));
    add(t("pg.huangji.step.yun", "", { s: p.shi.number, u: p.yun.number, ul: p.yun.label.replace(/\d+$/, ""), k: p.shi_in_yun }));
    add(t("pg.huangji.step.hui", "", { u: p.yun.number, h: p.hui.number, hl: p.hui.label.replace(/\d+$/, ""), k: p.yun_in_hui }));
    add(t(p.kaiwu ? "pg.huangji.step.kaiwu.in" : "pg.huangji.step.kaiwu.out", "", { u: p.yun.number }));
  }

  async function drawChronicle(p) {
    const box = $("hj-chron"); box.textContent = "";
    if (!chronicle) {
      try { chronicle = await fetch(assetRoot + "data/huangji-chronicle.json", { cache: "no-cache" }).then((r) => r.json()); }
      catch (e) { box.append(el("p", "mh-error", t("pg.huangji.error.load"))); return; }
    }
    const c = chronicle;
    const entry = (y) => (y >= c.first_year && y <= c.last_year ? c.entries[y - c.first_year] : undefined);
    const here = entry(p.year);
    const name = yearText(p.year) + " " + p.year_gz;
    if (here === undefined) box.append(el("p", "", t("pg.huangji.chron.outside", "", { year: yearText(p.year) })));
    else if (here === null) box.append(el("p", "", t("pg.huangji.chron.missing", "", { year: yearText(p.year) })));
    else if (here === "") box.append(el("p", "", t("pg.huangji.chron.blank", "", { year: name })));
    else { box.append(el("p", "", t("pg.huangji.chron.year", "", { year: name }))); box.append(el("p", "mh-quote hj-entry", here)); }
    if (p.shi.last_year < c.first_year || p.shi.first_year > c.last_year) return;
    let held = false;
    for (let y = p.shi.first_year; y <= p.shi.last_year; y += 1) if (entry(y) !== null && entry(y) !== undefined) held = true;
    if (!held) return;                                   // the whole 世 is missing from the online copy
    box.append(el("p", "soft small", t("pg.huangji.chron.shi", "", { span: span(p.shi.first_year, p.shi.last_year) })));
    const list = el("ol", "hj-list");
    for (let y = p.shi.first_year; y <= p.shi.last_year; y += 1) {
      const text = entry(y);
      if (!text) continue;
      const li = el("li", y === p.year ? "here" : "");
      li.append(el("b", "", yearText(y)), el("span", "hj-text", text));
      list.append(li);
    }
    if (list.children.length) box.append(list); else box.append(el("p", "soft small", t("pg.huangji.chron.none")));
  }

  function place(event) {
    if (event) event.preventDefault();
    const error = $("hj-error"); error.hidden = true;
    const year = readYear();
    if (year === null) { error.textContent = t("pg.huangji.error.input"); error.hidden = false; return; }
    let p;
    try { p = engine.call({ cmd: "huangji", year }); } catch (e) { error.textContent = t("pg.huangji.error.input"); error.hidden = false; console.error(e); return; }
    $("result").hidden = false;
    $("result-title").textContent = t("pg.huangji.title.result", "", { year: yearText(p.year), gz: p.year_gz, hui: p.hui.label.replace(/\d+$/, "") + " " + p.hui.number, yun: p.yun.label.replace(/\d+$/, "") + " " + p.yun.number, shi: p.shi.label.replace(/\d+$/, "") + " " + p.shi.number });
    drawBar(p); drawTable(p); drawSteps(p); drawChronicle(p);
    if (event) $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function init() {
    try {
      language = document.documentElement.dataset.lang || "en";
      assetRoot = language === "en" ? "../assets/" : "../../assets/";
      [engine, words] = await Promise.all([FTEngine.load(assetRoot + "wasm/ft.wasm"), fetch(assetRoot + "i18n/" + language + ".json", { cache: "no-cache" }).then((r) => r.json())]);
      $("hj-form").addEventListener("submit", place);
      $("hj-now").addEventListener("click", () => { setYear(new Date().getFullYear()); place(); });
      $("hj-birth").addEventListener("click", () => {
        const y = savedBirthYear();
        if (!y) { $("hj-error").textContent = t("pg.huangji.error.birth"); $("hj-error").hidden = false; return; }
        setYear(y); place();
      });
      $("lang").addEventListener("change", (event) => { const next = event.target.value; location.href = next === "en" ? "/huangji/" : "/" + next + "/huangji/"; });
      setYear(savedBirthYear() || new Date().getFullYear());
      place();
    } catch (error) {
      $("hj-error").textContent = t("pg.huangji.error.load", "The calculator could not load. Refresh and try again."); $("hj-error").hidden = false; console.error(error);
    }
  }
  init();
})();
