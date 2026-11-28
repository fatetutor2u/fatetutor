/* Fate Tutor 七政四餘 page. The Rust engine sets out the sky in this browser; this file reads the
   form, borrows birth details saved by other Fate Tutor pages, and draws the table and the palaces. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
  // Board as on the 紫微 page: 巳午未申 on top, 寅丑子亥 at the bottom, 辰卯 left, 酉戌 right.
  const PLACE = { 5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4], 4: [2, 1], 9: [2, 4], 3: [3, 1], 10: [3, 4], 2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4] };
  const CI = ["玄枵", "星紀", "析木", "大火", "壽星", "鶉尾", "鶉火", "鶉首", "實沈", "大梁", "降婁", "娵訾"];
  let engine, words = {}, language = "en";
  const zh = () => language.startsWith("zh");
  const t = (key, fallback, params) => {
    let text = words[key] || fallback || key;
    Object.entries(params || {}).forEach(([name, value]) => { text = text.split("{" + name + "}").join(value); });
    return text;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } };
  const dm = (x) => { const d = Math.floor(x), m = Math.floor((x - d) * 60); return d + "°" + String(m).padStart(2, "0") + "′"; };
  const signed = (x) => (x >= 0 ? "+" : "−") + dm(Math.abs(x));
  const bodyName = (b) => zh() ? t("pg.qizheng.body." + b.key, b.name_zh) : t("pg.qizheng.body." + b.key, b.key) + " " + b.name_zh;

  function savedBirth() {
    let raw = null;
    try { raw = sessionStorage.getItem("ft.birth"); } catch (e) { /* private mode */ }
    if (!raw) { try { if (localStorage.getItem("ft.birth.keep")) raw = localStorage.getItem("ft.birth"); } catch (e) { /* */ } }
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function fillForm() {
    const b = savedBirth();
    $("qz-tz").value = zone();
    if (b && b.date) {
      $("qz-date").value = b.date;
      if (b.time && !b.notime) $("qz-time").value = b.time;
      const tz = b.zone || (b.place && b.place.tz);
      if (tz) $("qz-tz").value = tz;
      if (b.place && typeof b.place.lon === "number") $("qz-lon").value = b.place.lon;
      $("qz-saved").hidden = false;
    }
  }

  function drawTable(c) {
    const body = $("qz-rows"); body.textContent = "";
    c.bodies.forEach((b) => {
      const tr = el("tr");
      tr.append(el("td", "qz-name", bodyName(b)));
      tr.append(el("td", "qz-han", b.palace_zh + " " + CI[b.palace]));
      tr.append(el("td", "qz-han", b.mansion_zh + " " + dm(b.mansion_degree)));
      tr.append(el("td", "qz-num", dm(b.longitude)));
      tr.append(el("td", "", b.motion ? t("pg.qizheng.motion." + b.motion) : "—"));
      body.append(tr);
    });
  }

  function drawBoard(c) {
    const board = $("qz-board");
    board.querySelectorAll(".zw-cell").forEach((n) => n.remove());
    c.palaces.forEach((p) => {
      const cell = el("div", "zw-cell" + (p.branch === c.life ? " life" : ""));
      const [row, col] = PLACE[p.branch];
      cell.style.gridRow = row; cell.style.gridColumn = col;
      const head = el("div", "zw-head");
      head.append(el("span", "zw-name", t("pg.qizheng.role." + p.role, p.role_zh)));
      cell.append(head);
      const stars = el("div", "zw-stars");
      p.bodies.forEach((k) => {
        const b = c.bodies.find((x) => x.key === k);
        stars.append(el(["sun", "moon"].includes(k) ? "b" : "span", "", zh() ? t("pg.qizheng.body." + k, b.name_zh) : b.name_zh));
      });
      cell.append(stars);
      cell.append(el("div", "zw-sub zw-gz", p.branch_zh + " · " + p.ci_zh + " · " + p.sign_zh));
      board.append(cell);
    });
    const center = $("qz-center"); center.textContent = "";
    center.append(el("b", "", "命 " + c.life_zh));
    center.append(el("div", "", "☉ " + BRANCHES[c.sun_palace] + " " + CI[c.sun_palace]));
    center.append(el("div", "", c.hour_zh + (zh() ? "時" : " hour")));
  }

  function drawSteps(c) {
    const out = $("qz-steps"); out.textContent = "";
    const add = (text) => out.append(el("li", "", text));
    const m = c.moment, r = c.remainders;
    add(t("pg.qizheng.step.time", "", { t: m.local_used, basis: t("pg.qizheng.basis." + m.time_basis), h: c.hour_zh }));
    add(t("pg.qizheng.step.life", "", { sun: BRANCHES[c.sun_palace], h: c.hour_zh, life: c.life_zh }));
    add(t("pg.qizheng.step.apogee", "", { m: dm(r.apogee_mean), a: signed(r.apogee_first), b: signed(r.apogee_second), r: dm(r.yuebei) }));
    add(t("pg.qizheng.step.node", "", { m: dm(r.node_mean), a: signed(r.node_first), b: signed(r.node_second), r: dm(r.jidu), o: dm(r.luohou) }));
    add(t("pg.qizheng.step.ziqi", "", { r: dm(r.ziqi) }));
  }

  function cast(event) {
    if (event) event.preventDefault();
    const error = $("qz-error"); error.hidden = true;
    const date = $("qz-date").value, time = $("qz-time").value, tz = $("qz-tz").value.trim();
    const lon = $("qz-lon").value === "" ? null : Number($("qz-lon").value);
    const year = Number(date.slice(0, 4));
    if (!date || !time || !tz || year < 1901 || year > 2099 || (lon !== null && !(lon >= -180 && lon <= 180))) { error.textContent = t("pg.qizheng.error.input"); error.hidden = false; return; }
    const req = { cmd: "qizheng", date, time, tz };
    if (lon !== null) req.lon = lon; else req.time_basis = "clock";
    let c;
    try { c = engine.call(req); } catch (e) { error.textContent = t("pg.qizheng.error.input"); error.hidden = false; console.error(e); return; }
    $("result").hidden = false;
    $("result-title").textContent = t("pg.qizheng.title.result", "", { life: c.life_zh + " " + CI[c.life], sun: BRANCHES[c.sun_palace] + " " + CI[c.sun_palace] });
    drawTable(c); drawBoard(c); drawSteps(c);
    if (event) $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function init() {
    try {
      language = document.documentElement.dataset.lang || "en";
      const assetRoot = language === "en" ? "../assets/" : "../../assets/";
      [engine, words] = await Promise.all([FTEngine.load(assetRoot + "wasm/ft.wasm"), fetch(assetRoot + "i18n/" + language + ".json", { cache: "no-cache" }).then((r) => r.json())]);
      fillForm();
      $("qz-form").addEventListener("submit", cast);
      $("lang").addEventListener("change", (event) => { const next = event.target.value; location.href = next === "en" ? "/qizheng/" : "/" + next + "/qizheng/"; });
      if ($("qz-date").value && $("qz-time").value) cast();
    } catch (error) {
      $("qz-error").textContent = t("pg.qizheng.error.load", "The calculator could not load. Refresh and try again."); $("qz-error").hidden = false; console.error(error);
    }
  }
  init();
})();
