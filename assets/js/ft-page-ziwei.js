/* Fate Tutor 紫微斗數 page. The Rust engine sets out the chart in this browser; this file
   reads the form, borrows birth details saved by other Fate Tutor pages, and draws the board. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
  // Classic board: 巳午未申 on top, 寅丑子亥 at the bottom, 辰卯 left, 酉戌 right.
  const PLACE = { 5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4], 4: [2, 1], 9: [2, 4], 3: [3, 1], 10: [3, 4], 2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4] };
  let engine, words = {}, language = "en";
  const t = (key, fallback, params) => {
    let text = words[key] || fallback || key;
    Object.entries(params || {}).forEach(([name, value]) => { text = text.split("{" + name + "}").join(value); });
    return text;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } };

  function savedBirth() {
    let raw = null;
    try { raw = sessionStorage.getItem("ft.birth"); } catch (e) { /* private mode */ }
    if (!raw) { try { if (localStorage.getItem("ft.birth.keep")) raw = localStorage.getItem("ft.birth"); } catch (e) { /* */ } }
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function fillForm() {
    const b = savedBirth();
    $("zw-tz").value = zone();
    if (b && b.date) {
      $("zw-date").value = b.date;
      if (b.time && !b.notime) $("zw-time").value = b.time;
      const tz = b.zone || (b.place && b.place.tz);
      if (tz) $("zw-tz").value = tz;
      if (b.place && typeof b.place.lon === "number") $("zw-lon").value = b.place.lon;
      if (b.sex === "male" || b.sex === "female") $("zw-sex").value = b.sex;
      $("zw-saved").hidden = false;
    }
  }

  function drawBoard(c) {
    const board = $("zw-board");
    board.querySelectorAll(".zw-cell").forEach((n) => n.remove());
    c.palaces.forEach((p) => {
      const cell = el("div", "zw-cell" + (p.is_life ? " life" : "") + (p.is_body ? " body" : ""));
      const [row, col] = PLACE[p.branch];
      cell.style.gridRow = row; cell.style.gridColumn = col;
      const head = el("div", "zw-head");
      const name = el("span", "zw-name", t("pg.ziwei.palace." + p.name));
      const tags = el("span", "zw-tags");
      if (p.is_life) tags.append(el("span", "", "命"));
      if (p.is_body) tags.append(el("span", "b", t("pg.ziwei.body", "身")));
      head.append(name, tags);
      const stars = el("div", "zw-stars");
      p.stars.slice().sort((a, b) => (b.major - a.major)).forEach((s) => {
        const node = el(s.major ? "b" : "span", "", t("pg.ziwei.star." + s.key, s.name_zh));
        if (s.hua) node.append(el("sup", s.hua === "ji" ? "ji" : "", t("pg.ziwei.hua." + s.hua)));
        stars.append(node);
      });
      const period = (c.daxian || []).find((d) => d.branch === p.branch);
      const age = period ? el("div", "zw-sub zw-age", t("pg.ziwei.cell.age", "", { a: period.from_age, b: period.to_age })) : null;
      const foot = el("div", "zw-sub zw-gz", p.stem_zh + p.branch_zh + (p.name === "life" || language.startsWith("zh") ? "" : " · " + p.name_zh));
      cell.append(head, stars);
      if (age) cell.append(age);
      cell.append(foot);
      board.append(cell);
    });
  }

  function drawCenter(c) {
    const m = c.moment, lunar = m.lunar;
    const center = $("zw-center"); center.textContent = "";
    center.append(el("b", "", t("pg.ziwei.center.year", "", { gz: c.year_zh })));
    center.append(el("div", "", t("pg.ziwei.center.lunar", "", { m: lunar.month, d: lunar.day, leap: lunar.is_leap ? t("pg.ziwei.center.leap") : "" })));
    center.append(el("div", "", t("pg.ziwei.center.hour", "", { h: c.hour_zh })));
    center.append(el("div", "", t("pg.ziwei.center.bureau", "", { nayin: c.bureau.nayin_zh, el: t("pg.ziwei.el." + c.bureau.element), n: c.bureau.number })));
    center.append(el("small", "", t("pg.ziwei.center.basis." + m.time_basis, "", { t: m.local_used })));
  }

  function drawSteps(c) {
    const out = $("zw-steps"); out.textContent = "";
    const add = (text) => out.append(el("li", "", text));
    const m = c.moment;
    if (m.late_zi_hour) add(t("pg.ziwei.step.late"));
    if (m.lunar.is_leap) add(t("pg.ziwei.step.leap", "", { m: c.month }));
    const mp = BRANCHES[(2 + c.month - 1) % 12];
    add(t("pg.ziwei.step.month", "", { m: c.month, mp }));
    add(t("pg.ziwei.step.life", "", { mp, h: c.hour_zh, life: BRANCHES[c.life_branch], body: BRANCHES[c.body_branch] }));
    const life = c.palaces[c.life_branch];
    add(t("pg.ziwei.step.bureau", "", { ys: c.year_zh[0], yin: c.palaces[2].stem_zh + "寅", gz: life.stem_zh + life.branch_zh, nayin: c.bureau.nayin_zh, el: t("pg.ziwei.el." + c.bureau.element), n: c.bureau.number }));
    add(t("pg.ziwei.step.ziwei", "", { d: c.day, n: c.bureau.number, zw: BRANCHES[c.ziwei_branch], tf: BRANCHES[c.tianfu_branch] }));
    if (c.daxian) {
      const first = c.daxian[0], yang = "甲丙戊庚壬".includes(c.year_zh[0]);
      add(t("pg.ziwei.step.daxian", "", { kind: t("pg.ziwei.kind." + (yang ? "yang_" : "yin_") + c.sex), pname: t("pg.ziwei.palace." + c.palaces[first.branch].name),
        br: first.branch_zh, dir: t("pg.ziwei.dir." + (c.daxian_forward ? "forward" : "backward")), a: first.from_age, b: first.to_age }));
    } else add(t("pg.ziwei.step.daxian.none"));
  }

  function cast(event) {
    if (event) event.preventDefault();
    const error = $("zw-error"); error.hidden = true;
    const date = $("zw-date").value, time = $("zw-time").value, tz = $("zw-tz").value.trim();
    const lon = $("zw-lon").value === "" ? null : Number($("zw-lon").value);
    const year = Number(date.slice(0, 4));
    if (!date || !time || !tz || year < 1901 || year > 2099 || (lon !== null && !(lon >= -180 && lon <= 180))) { error.textContent = t("pg.ziwei.error.input"); error.hidden = false; return; }
    const req = { cmd: "ziwei", date, time, tz };
    if ($("zw-sex").value) req.sex = $("zw-sex").value;
    if (lon !== null) req.lon = lon; else req.time_basis = "clock";
    let c;
    try { c = engine.call(req); } catch (e) { error.textContent = t("pg.ziwei.error.input"); error.hidden = false; console.error(e); return; }
    $("result").hidden = false;
    $("result-title").textContent = c.year_zh + " · " + c.palaces[c.life_branch].stem_zh + c.palaces[c.life_branch].branch_zh + " 命 · " + c.bureau.nayin_zh;
    drawBoard(c); drawCenter(c); drawSteps(c);
    if (event) $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function init() {
    try {
      language = document.documentElement.dataset.lang || "en";
      const assetRoot = language === "en" ? "../assets/" : "../../assets/";
      [engine, words] = await Promise.all([FTEngine.load(assetRoot + "wasm/ft.wasm"), fetch(assetRoot + "i18n/" + language + ".json", { cache: "no-cache" }).then((r) => r.json())]);
      fillForm();
      $("zw-form").addEventListener("submit", cast);
      $("zw-sex").addEventListener("change", () => { if ($("zw-date").value && $("zw-time").value) cast(); });
      $("lang").addEventListener("change", (event) => { const next = event.target.value; location.href = next === "en" ? "/ziwei/" : "/" + next + "/ziwei/"; });
      if ($("zw-date").value && $("zw-time").value) cast();
    } catch (error) {
      $("zw-error").textContent = t("pg.ziwei.error.load", "The calculator could not load. Refresh and try again."); $("zw-error").hidden = false; console.error(error);
    }
  }
  init();
})();
