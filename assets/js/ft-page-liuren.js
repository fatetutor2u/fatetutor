/* Fate Tutor 大六壬 page. The Rust engine lays out the chart in this browser; this file reads
   the form (a moment, or a day, month general and hour given directly) and draws the result. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STEMS = "甲乙丙丁戊己庚辛壬癸", BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
  const SPIRITS = ["神后", "大吉", "功曹", "太衝", "天罡", "太乙", "勝光", "小吉", "傳送", "從魁", "河魁", "登明"];
  // Earth plate as the book draws it: 巳午未申 on top, 寅丑子亥 at the bottom, 辰卯 left, 酉戌 right.
  const PLACE = { 5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4], 4: [2, 1], 9: [2, 4], 3: [3, 1], 10: [3, 4], 2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4] };
  const WAY_QUOTE = { yuanshou: "zeike_way", chongshen: "zeike_way", zhiyi: "biyong", shehai: "shehai", jianji: "shehai", chawei: "shehai", zhuixia: "shehai",
    haoshi: "yaoke", danshe: "yaoke", hushi: "maoxing", dongshe: "maoxing", biezhe: "biezhe", bazhuan: "bazhuan",
    fuyin_ziren: "fuyin", fuyin_zixin: "fuyin", fuyin_duchuan: "fuyin", fuyin_ke: "fuyin", jinglan: "fanyin" };
  let engine, words = {}, language = "en";
  const zh = () => language.startsWith("zh");
  const t = (key, fallback, params) => {
    let text = words[key] || fallback || key;
    Object.entries(params || {}).forEach(([name, value]) => { text = text.split("{" + name + "}").join(value); });
    return text;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const pad = (n) => String(n).padStart(2, "0");
  const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } };
  const general = (key, zhName) => zh() ? t("pg.liuren.gen." + key, zhName) : t("pg.liuren.gen." + key, key) + " " + zhName;

  function setNow() {
    const d = new Date();
    $("lr-date").value = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    $("lr-time").value = pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function fillManual() {
    const day = $("lr-m-day"), gen = $("lr-m-general"), hour = $("lr-m-hour");
    for (let i = 0; i < 60; i++) day.append(new Option(STEMS[i % 10] + BRANCHES[i % 12], String(i)));
    for (let b = 0; b < 12; b++) {
      gen.append(new Option(BRANCHES[b] + " " + SPIRITS[b], String(b)));
      hour.append(new Option(BRANCHES[b], String(b)));
    }
  }

  function daytime() {
    const v = document.querySelector('input[name="daynight"]:checked').value;
    return v === "auto" ? undefined : v === "day";
  }

  function drawFacts(c) {
    const m = c.moment;
    $("lr-f-day").textContent = c.day_zh + (m && m.late_zi_hour ? " (23:00 →)" : "");
    let g = c.month_general_zh + " " + c.month_general_name_zh;
    if (m) g += " · " + t("pg.liuren.fact.term", "", { term: zh() ? m.term_zh : m.term_en + " " + m.term_zh, days: Math.floor(m.days_since_term) });
    $("lr-f-general").textContent = g;
    $("lr-f-hour").textContent = c.hour_zh;
    const n = c.noble;
    $("lr-f-noble").textContent = n.branch_zh + " · " + t(n.daytime ? "pg.liuren.noble.day" : "pg.liuren.noble.night") + ", " +
      t(n.forward ? "pg.liuren.noble.forward" : "pg.liuren.noble.backward", "", { seat: BRANCHES[n.seat] });
    $("lr-f-empty").textContent = c.empty_zh;
  }

  function drawLessons(c) {
    const box = $("lr-lessons"); box.textContent = "";
    c.lessons.slice().reverse().forEach((l) => {
      const col = el("div", "lr-lesson" + (l.repeated ? " repeated" : "") + (l.relation !== "none" ? " struck" : ""));
      col.append(el("span", "lr-n", t("pg.liuren.lesson.n", "", { n: l.number })));
      col.append(el("span", "lr-gen", general(l.general, l.general_zh)));
      col.append(el("b", "lr-up", l.upper_zh));
      col.append(el("span", "lr-low", l.lower_zh));
      col.append(el("span", "lr-rel", t("pg.liuren.rel." + l.relation)));
      if (l.repeated) col.append(el("span", "lr-rep", t("pg.liuren.lesson.repeated")));
      box.append(col);
    });
  }

  function drawThree(c) {
    const list = $("lr-three"); list.textContent = "";
    ["first", "middle", "last"].forEach((k, i) => {
      const tr = c.transmissions[i];
      const li = el("li", tr.empty ? "empty" : "");
      li.append(el("span", "lr-tn", t("pg.liuren.three." + k)), el("b", "", tr.branch_zh), el("span", "lr-gen", general(tr.general, tr.general_zh)));
      if (tr.empty) li.append(el("span", "lr-empty", t("pg.liuren.three.empty")));
      list.append(li);
    });
  }

  function drawSteps(c) {
    const out = $("lr-steps"); out.textContent = "";
    const add = (text) => { const li = el("li", "", text); out.append(li); return li; };
    add(t("pg.liuren.step.plate", "", { g: c.month_general_zh, name: c.month_general_name_zh, h: c.hour_zh, s: c.shift }));
    add(t("pg.liuren.step.lessons", "", { stem: c.day_zh[0], lodge: BRANCHES[c.lessons[0].seat], branch: c.day_zh[1] }));
    if (c.bazhuan_day) add(t("pg.liuren.way.bazhuan_day"));
    else if (!c.complete) {
      const li = add(t(c.order_from === "branch" ? "pg.liuren.step.bubei" : "pg.liuren.step.bubei_yang") + " ");
      li.append(el("span", "mh-quote-inline", t("pg.liuren.quote.bubei")));
    }
    if (c.fanyin && c.method.key !== "jinglan") add(t("pg.liuren.way.fanyin"));
    add(t("pg.liuren.way." + c.method.key));
    const cands = c.method.candidates;
    if (cands.length > 1) {
      const list = cands.map((x) => t("pg.liuren.cand", "", {
        b: x.branch_zh, l: x.lessons.join("/"),
        alike: x.matches_day ? t("pg.liuren.cand.alike") : "",
        depth: x.depth === null || x.depth === undefined ? "" : t("pg.liuren.cand.depth", "", { d: x.depth, c: x.seat_class_zh }),
      })).join(zh() ? "；" : "; ");
      add(t("pg.liuren.step.weighed", "", { list }));
    }
    const how = c.method.how_middle === "heaven" ? "heaven" : (c.method.how_middle === "punish" || c.method.how_middle === "day_or_branch" ? "punish" : "fixed");
    add(t("pg.liuren.step.middle." + how));
    $("lr-way-quote").textContent = t("pg.liuren.quote." + (WAY_QUOTE[c.method.key] || "zeike_way"));
  }

  function drawBoard(c) {
    const board = $("lr-board");
    board.querySelectorAll(".zw-cell").forEach((n) => n.remove());
    const used = new Set(c.transmissions.map((x) => x.branch));
    for (let earth = 0; earth < 12; earth++) {
      const heaven = c.heaven[earth];
      const cell = el("div", "zw-cell lr-cell" + (used.has(heaven) ? " used" : "") + (heaven === c.noble.branch ? " noble" : "") + (earth === c.hour ? " hour" : ""));
      const [row, col] = PLACE[earth];
      cell.style.gridRow = row; cell.style.gridColumn = col;
      cell.append(el("b", "lr-heaven", BRANCHES[heaven]));
      const g = c.generals[heaven];
      const gi = ["noble", "snake", "bird", "harmony", "hook", "dragon", "void", "tiger", "constancy", "warrior", "moon", "queen"].indexOf(g);
      const gzh = ["貴人", "螣蛇", "朱雀", "六合", "勾陳", "青龍", "天空", "白虎", "太常", "玄武", "太陰", "天后"][gi];
      cell.append(el("span", "lr-gen", general(g, gzh)));
      cell.append(el("span", "zw-sub lr-earth", BRANCHES[earth] + (earth === c.hour ? " · " + t("pg.liuren.fact.hour") : "")));
      board.append(cell);
    }
    const center = $("lr-center"); center.textContent = "";
    center.append(el("b", "", c.day_zh));
    center.append(el("div", "", c.month_general_zh + "將 · " + c.hour_zh + "時"));
    center.append(el("div", "", c.method.family_zh + " · " + c.method.name_zh));
    center.append(el("small", "", c.transmissions.map((x) => x.branch_zh).join(" → ")));
  }

  function show(c) {
    $("result").hidden = false;
    $("result-title").textContent = c.day_zh + "日 · " + c.month_general_zh + "將" + c.hour_zh + "時 · " + c.method.name_zh;
    drawFacts(c); drawLessons(c); drawThree(c); drawSteps(c); drawBoard(c);
  }

  function run(req, scroll) {
    const error = $("lr-error"); error.hidden = true;
    const dn = daytime();
    if (dn !== undefined) req.daytime = dn;
    let c;
    try { c = engine.call(req); } catch (e) { error.textContent = t("pg.liuren.error.input"); error.hidden = false; console.error(e); return; }
    show(c);
    if (scroll) $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function castMoment(event) {
    if (event) event.preventDefault();
    const date = $("lr-date").value, time = $("lr-time").value, year = Number(date.slice(0, 4));
    if (!date || !time || year < 1901 || year > 2099) { $("lr-error").textContent = t("pg.liuren.error.input"); $("lr-error").hidden = false; return; }
    run({ cmd: "liuren", date, time, tz: zone() }, !!event);
  }

  function castManual() {
    const d = Number($("lr-m-day").value);
    run({ cmd: "liuren", day_stem: d % 10, day_branch: d % 12, month_general: Number($("lr-m-general").value), hour: Number($("lr-m-hour").value) }, true);
  }

  async function init() {
    try {
      language = document.documentElement.dataset.lang || "en";
      const assetRoot = language === "en" ? "../assets/" : "../../assets/";
      [engine, words] = await Promise.all([FTEngine.load(assetRoot + "wasm/ft.wasm"), fetch(assetRoot + "i18n/" + language + ".json", { cache: "no-cache" }).then((r) => r.json())]);
      $("lr-tz").textContent = t("pg.liuren.tz", "Time zone: {tz}", { tz: zone() });
      setNow(); fillManual();
      $("lr-form").addEventListener("submit", castMoment);
      $("lr-now").addEventListener("click", () => { setNow(); castMoment(); });
      $("lr-manual-go").addEventListener("click", castManual);
      document.querySelectorAll('input[name="daynight"]').forEach((r) => r.addEventListener("change", () => castMoment()));
      $("lang").addEventListener("change", (event) => { const next = event.target.value; location.href = next === "en" ? "/liuren/" : "/" + next + "/liuren/"; });
      castMoment();
    } catch (error) {
      $("lr-error").textContent = t("pg.liuren.error.load", "The calculator could not load. Refresh and try again."); $("lr-error").hidden = false; console.error(error);
    }
  }
  init();
})();
