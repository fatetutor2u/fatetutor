/* Fate Tutor 梅花易數 page. The Rust engine does every calculation in this browser;
   this file only reads the form and shows the engine's answer, step by step. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
  const SYMBOL = { "乾": "☰", "兌": "☱", "離": "☲", "震": "☳", "巽": "☴", "坎": "☵", "艮": "☶", "坤": "☷" };
  const BY_PATTERN = { 7: "乾", 3: "兌", 5: "離", 1: "震", 6: "巽", 2: "坎", 4: "艮", 0: "坤" };
  // 「寅卯之月日則木旺，巳午之月日火旺，申酉之月日金旺，亥子之月日水旺，辰戌丑未之月日土旺」
  const RULING = { "寅": "wood", "卯": "wood", "巳": "fire", "午": "fire", "申": "metal", "酉": "metal", "亥": "water", "子": "water", "辰": "earth", "戌": "earth", "丑": "earth", "未": "earth" };
  const USES_HOUR = { date_time: true, object_count: true, sound_count: true, sound_pair: true, zhang_chi: false, chi_cun: true };
  let engine, words = {}, language = "en";

  const t = (key, fallback, params) => {
    let text = words[key] || fallback || key;
    Object.entries(params || {}).forEach(([name, value]) => { text = text.split("{" + name + "}").join(value); });
    return text;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const tri = (name) => name + " " + SYMBOL[name];
  const method = () => document.querySelector('input[name="method"]:checked').value;
  const pad = (n) => String(n).padStart(2, "0");

  function setNow() {
    const d = new Date();
    $("mh-date").value = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    $("mh-time").value = pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function showMethod() {
    const m = method();
    document.querySelectorAll(".mh-fields [data-for]").forEach((f) => { f.hidden = !f.dataset.for.split(" ").includes(m); });
    $("mh-time").closest(".field").hidden = !USES_HOUR[m];
    $("mh-hint").textContent = t("pg.meihua.hint." + m);
    $("mh-rule-quote").textContent = t("pg.meihua.quote." + m);
  }

  function request() {
    const m = method();
    const req = { cmd: "meihua", method: m, date: $("mh-date").value, time: $("mh-time").value || "12:00" };
    const num = (id) => Number($(id).value);
    if (m === "object_count" || m === "sound_count") req.count = num("mh-count");
    if (m === "sound_pair") { req.first = num("mh-first"); req.second = num("mh-second"); }
    if (m === "zhang_chi") { req.zhang = num("mh-zhang"); req.chi = num("mh-chi"); }
    if (m === "chi_cun") { req.chi = num("mh-chi"); req.cun = num("mh-cun"); }
    const numbers = Object.entries(req).filter(([k]) => !["cmd", "method", "date", "time"].includes(k)).map(([, v]) => v);
    if (!req.date || numbers.some((v) => !Number.isInteger(v) || v < 1 || v > 100000)) return null;
    return req;
  }

  // The parts that make each total, read from the engine's own answer.
  function parts(r) {
    const m = r.method, h = m.hour_branch;
    switch (m.method) {
      case "date_time": { const ymd = [m.year_branch, m.month, m.day]; return [ymd, ymd.concat(h), ymd.concat(h)]; }
      case "object_count": return [[m.count], [h], [m.count, h]];
      case "sound_count": return [[m.count], [m.count, h], [m.count, h]];
      case "sound_pair": return [[m.first], [m.second], [m.first, m.second, h]];
      case "zhang_chi": return [[m.zhang], [m.chi], [m.zhang, m.chi]];
      default: return [[m.chi], [m.cun], [m.chi, m.cun, h]];
    }
  }

  function divide(n, d, what) {
    const r = n % d;
    return r ? t("pg.meihua.step.divide", "", { n, d, r, what }) : t("pg.meihua.step.divide_full", "", { n, d, what });
  }

  function steps(r) {
    const out = $("mh-steps"); out.textContent = "";
    const add = (text) => out.append(el("li", "", text));
    if (r.lunar) {
      add(t("pg.meihua.step.lunar", "", { year: r.lunar.year_stem_branch, yb: r.lunar.year_stem_branch.slice(-1), yn: r.method.year_branch || BRANCHES.indexOf(r.lunar.year_stem_branch.slice(-1)) + 1, m: r.lunar.month, d: r.lunar.day, leap: r.lunar.is_leap ? t("pg.meihua.step.leap") : "" }));
    }
    if (r.method.hour_branch) add(t("pg.meihua.step.hour", "", { hb: BRANCHES[r.method.hour_branch - 1], hn: r.method.hour_branch }));
    const [pu, pl, pm] = parts(r);
    const line = (label, p, n, d, what) => add((p.length > 1 ? t("pg.meihua.step.sum", "", { label, parts: p.join(" + "), n }) : t("pg.meihua.step.single", "{label}: {n}", { label, n })) + " · " + divide(n, d, what));
    line(t("pg.meihua.upper"), pu, r.totals[0], 8, tri(r.upper.name_zh));
    line(t("pg.meihua.lower"), pl, r.totals[1], 8, tri(r.lower.name_zh));
    line(t("pg.meihua.moving"), pm, r.totals[2], 6, t("pg.meihua.line", "", { n: r.moving_line }));
    if (r.hu_from_changed) add(t("pg.meihua.step.qiankun") + " " + t("pg.meihua.quote.qiankun"));
  }

  function hex(id, pattern, opts) {
    const root = $(id); root.textContent = "";
    for (let i = 5; i >= 0; i--) {
      let cls = "hex-line" + (((pattern >> i) & 1) ? "" : " yin");
      if (opts && opts.moving === i + 1) cls += " moving";
      if (opts && opts.ti && (opts.ti === "upper" ? i >= 3 : i < 3)) cls += " ti-part";
      root.append(el("div", cls));
    }
  }
  function triLabels(article, upper, lower, tiPos) {
    const [top, , bottom] = article.querySelectorAll(".mh-tri, .hex");
    const fill = (node, name, pos) => {
      node.textContent = tri(name) + " ";
      if (tiPos) node.append(el("b", "", pos === tiPos ? t("pg.meihua.ti") : t("pg.meihua.yong")));
    };
    fill(top, upper, "upper"); fill(bottom, lower, "lower");
  }
  const hexName = (h) => "#" + h.number + " · " + h.name_zh + " · " + h.pinyin;

  function relations(r) {
    const body = $("mh-rel"); body.textContent = "";
    r.relations.forEach((x) => {
      const row = el("tr");
      row.append(el("td", "", t("pg.meihua.with." + x.with) + " · " + tri(x.trigram.name_zh)));
      row.append(el("td", "", t("pg.meihua.el." + x.trigram.element)));
      row.append(el("td", "", t("pg.meihua.kind." + x.kind)));
      const book = el("td"); book.append(el("span", "q", t("pg.meihua.quote.rel." + x.kind)), el("span", "g", t("pg.meihua.gloss." + x.kind)));
      row.append(book); body.append(row);
    });
  }

  function season(r) {
    const branch = BRANCHES[(r.month + 1) % 12];
    $("mh-season-line").textContent = t("pg.meihua.season.line", "", { element: t("pg.meihua.el." + r.ti.element), m: r.month, branch, ruling: t("pg.meihua.el." + RULING[branch]) });
    $("mh-season-verdict").textContent = t("pg.meihua.season." + r.ti_strength);
  }

  function cast(event) {
    if (event) event.preventDefault();
    const error = $("mh-error"); error.hidden = true;
    const req = request();
    if (!req) { error.textContent = t("pg.meihua.error.input"); error.hidden = false; return; }
    let r;
    try { r = engine.call(req); } catch (e) { error.textContent = t("pg.meihua.error.input"); error.hidden = false; console.error(e); return; }
    $("result").hidden = false;
    $("result-title").textContent = hexName(r.original) + " → " + hexName(r.changed);
    steps(r);
    const [a1, a2, a3] = document.querySelectorAll("#result .hex-grid article");
    hex("hex-original", r.original.pattern, { moving: r.moving_line, ti: r.ti_position });
    triLabels(a1, r.upper.name_zh, r.lower.name_zh, r.ti_position);
    hex("hex-hu", r.hu.pattern); triLabels(a2, r.hu_upper.name_zh, r.hu_lower.name_zh);
    hex("hex-changed", r.changed.pattern); triLabels(a3, BY_PATTERN[r.changed.pattern >> 3], BY_PATTERN[r.changed.pattern & 7]);
    $("original-name").textContent = hexName(r.original); $("hu-name").textContent = hexName(r.hu); $("changed-name").textContent = hexName(r.changed);
    relations(r);
    if (r.ti_strength) season(r);
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function init() {
    try {
      language = document.documentElement.dataset.lang || "en";
      const assetRoot = language === "en" ? "../assets/" : "../../assets/";
      [engine, words] = await Promise.all([FTEngine.load(assetRoot + "wasm/ft.wasm"), fetch(assetRoot + "i18n/" + language + ".json", { cache: "no-cache" }).then((r) => r.json())]);
      setNow(); showMethod();
      document.querySelectorAll('input[name="method"]').forEach((x) => x.addEventListener("change", showMethod));
      $("mh-now").addEventListener("click", setNow);
      $("mh-form").addEventListener("submit", cast);
      $("lang").addEventListener("change", (event) => { const next = event.target.value; location.href = next === "en" ? "/meihua/" : "/" + next + "/meihua/"; });
    } catch (error) {
      $("mh-error").textContent = t("pg.meihua.error.load", "The calculator could not load. Refresh and try again."); $("mh-error").hidden = false; console.error(error);
    }
  }
  init();
})();
