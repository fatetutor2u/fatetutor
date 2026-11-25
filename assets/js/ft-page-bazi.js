/*!
 * Fate Tutor — BaZi page (bazi/). Uses ft-lesson.js.
 * Cards: the ten Day Masters (Heavenly Stems). Demo: the four pillars are built
 * one by one — clock time to sun time, the Sun's place for the year and month,
 * the sixty-day count for the day, the two-hour block for the hour, then a
 * count of the five elements.
 */
(function () {
  "use strict";

  const IDS = ["jia", "yi", "bing", "ding", "wu", "ji", "geng", "xin", "ren", "gui"];
  const STEM = "甲乙丙丁戊己庚辛壬癸";
  const NAME = ["Jia", "Yi", "Bing", "Ding", "Wu", "Ji", "Geng", "Xin", "Ren", "Gui"];
  const PINYIN = ["jiǎ", "yǐ", "bǐng", "dīng", "wù", "jǐ", "gēng", "xīn", "rén", "guǐ"];
  const BRANCH = "子丑寅卯辰巳午未申酉戌亥";
  const ELEMENTS = ["wood", "fire", "earth", "metal", "water"];
  const EL_HAN = "木火土金水";
  const COLOR = { wood: "#5fd4a0", fire: "#ff8a6b", earth: "#e9c349", metal: "#cbd5e1", water: "#7bd0ff" };
  const GODS = ["bi_jian", "jie_cai", "shi_shen", "shang_guan", "pian_cai", "zheng_cai", "qi_sha", "zheng_guan", "pian_yin", "zheng_yin"];
  // Opening line of each stem's verse in 滴天髓 · 天干論 (same text as rust/ft-reading/src/rules.rs).
  const VERSE = [
    "甲木參天，脱胎要火", "乙木雖柔，刲羊解牛", "丙火猛烈，欺霜侮雪", "丁火柔中，內性昭融", "戊土固重，既中且正",
    "己土卑濕，中正蓄藏", "庚金帶煞，剛強為最", "辛金軟弱，溫潤而清", "壬水汪洋，能洩金氣", "癸水至弱，達於天津",
  ];
  const PILLARS = ["year", "month", "day", "hour"];
  // The engine gives Ten God names in simplified characters; these are the ones that differ.
  const HANT = { "财": "財", "伤": "傷", "杀": "殺" };
  const LOCALE = { en: "en-GB", "zh-hans": "zh-CN", "zh-hant": "zh-TW", id: "id-ID", ms: "ms-MY" };

  const items = IDS.map((id, i) => ({ id: id, i: i }));
  const stemElement = (s) => ELEMENTS[Math.floor(s / 2)];
  const isYang = (s) => s % 2 === 0;
  const mod = (a, n) => ((a % n) + n) % n;

  // Same rule as ft_bazi::ten_god_index: element relation × 2, plus 1 if the polarity differs.
  function tenGod(day, other) {
    const relation = mod(Math.floor(other / 2) - Math.floor(day / 2), 5);
    return GODS[relation * 2 + (day % 2 === other % 2 ? 0 : 1)];
  }

  const num1 = (x, api) => new Intl.NumberFormat(LOCALE[api.lang] || "en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(x);
  const hhmm = (iso) => (iso && iso.length >= 16 ? iso.slice(11, 16) : "");
  const minutesOf = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  const clockText = (m) => { const v = mod(Math.round(m), 1440); return String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0"); };
  const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n);

  function dmValue(stem, api) {
    return api.t("bazi.daymaster.value", { stem: STEM[stem], polarity: api.t("polarity." + (isYang(stem) ? "yang" : "yin")), element: api.elementName(stemElement(stem)) });
  }

  // Where each stem sits in a chart: { stem: { shown: ["year", ...], hidden: ["month", ...] } }
  function stemsInChart(b) {
    const out = {};
    PILLARS.forEach((k) => {
      const p = b[k];
      if (!p) return;
      (out[p.stem] = out[p.stem] || { shown: [], hidden: [] }).shown.push(k);
      (p.hidden || []).forEach((h) => {
        const e = (out[h.stem] = out[h.stem] || { shown: [], hidden: [] });
        if (!e.hidden.includes(k)) e.hidden.push(k);
      });
    });
    return out;
  }

  function statementFor(item) {
    return {
      tradition: "bazi", theme: "character", rule: "bazi.day_master." + item.id,
      params: { stem_zh: STEM[item.i], element: stemElement(item.i), yang: isYang(item.i) },
      source: { kind: "classical_text", work: "滴天髓 (Di Tian Sui)", passage: "天干論", quote: VERSE[item.i] },
    };
  }

  // ------------------------------------------------------------ the demo
  const CX = 176, CY = 226, R = 136;
  const COLX = [390, 454, 518, 582], COLW = 58;
  const BAR_X = 390, BAR_W = 250;
  const ui = {};
  const rad = (deg) => (deg * Math.PI) / 180;
  // Sun longitude → screen angle: Start of Spring (315°) at the top, the Sun moving anticlockwise.
  const lonAngle = (L) => rad(-90 - (L - 315));
  const at = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  const pt = (r, a) => at(r, a).map((v) => v.toFixed(1)).join(" ");

  // Ring sector between screen angles a0 < a1 (radians), clockwise on screen.
  function ring(a0, a1, r0, r1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return "M " + pt(r0, a0) + " L " + pt(r1, a0) + " A " + r1 + " " + r1 + " 0 " + large + " 1 " + pt(r1, a1) +
      " L " + pt(r0, a1) + " A " + r0 + " " + r0 + " 0 " + large + " 0 " + pt(r0, a0) + " Z";
  }

  function setup(host, api) {
    const s = api.svg;
    host.textContent = "";
    const root = s("svg", { viewBox: "0 0 660 420", class: "demo-svg" });

    ui.head = s("text", { x: 24, y: 32, class: "w-head" });
    ui.line = s("text", { x: 24, y: 56, class: "w-line" });
    root.appendChild(ui.head); root.appendChild(ui.line);

    // 1) The Sun's yearly path with the 24 solar terms and the 12 months between the "jie" terms.
    ui.gE = s("g");
    ui.msec = []; ui.mlab = [];
    for (let m = 0; m < 12; m++) {
      const L0 = 285 + 30 * m;   // the jie term that opens this month
      const p = s("path", { d: ring(lonAngle(L0 + 30), lonAngle(L0), 70, R - 14), class: "sector" });
      ui.gE.appendChild(p); ui.msec.push(p);
      const mid = lonAngle(L0 + 15);
      const xy = at(98, mid);
      const lab = s("text", { x: xy[0].toFixed(1), y: (xy[1] + 5).toFixed(1), class: "w-branch", "text-anchor": "middle", text: BRANCH[(m + 1) % 12] });
      ui.gE.appendChild(lab); ui.mlab.push(lab);
    }
    ui.gE.appendChild(s("circle", { cx: CX, cy: CY, r: R, class: "ecl" }));
    for (let i = 0; i < 24; i++) {
      const L = 285 + 15 * i, a = lonAngle(L), jie = i % 2 === 0, lc = i === 2;
      const a1 = at(R - (lc ? 16 : jie ? 10 : 5), a), a2 = at(R + (lc ? 10 : jie ? 6 : 3), a);
      ui.gE.appendChild(s("line", { x1: a1[0].toFixed(1), y1: a1[1].toFixed(1), x2: a2[0].toFixed(1), y2: a2[1].toFixed(1), class: "tick" + (jie ? " jie" : "") + (lc ? " lichun" : "") }));
    }
    ui.gE.appendChild(s("text", { x: CX, y: CY - R - 14, class: "lc-label", "text-anchor": "middle", text: "立春 315°" }));
    ui.trail = s("path", { class: "trail", d: "M 0 0" });
    ui.sun = s("circle", { r: 8, class: "sun", cx: CX, cy: CY - R });
    ui.gE.appendChild(ui.trail); ui.gE.appendChild(ui.sun);
    root.appendChild(ui.gE);

    // 2) The unbroken sixty-day cycle.
    ui.g60 = s("g", { opacity: 0 });
    ui.dots = [];
    for (let j = 0; j < 60; j++) {
      const xy = at(112, rad(-90 + j * 6));
      const c = s("circle", { cx: xy[0].toFixed(1), cy: xy[1].toFixed(1), r: 4.2, class: "d60" });
      ui.g60.appendChild(c); ui.dots.push(c);
    }
    ui.g60.appendChild(s("text", { x: CX, y: CY - 126, class: "d60-label", "text-anchor": "middle", text: "甲子" }));
    root.appendChild(ui.g60);

    // 3) The twelve two-hour blocks of the day, 子 centred on midnight.
    ui.gH = s("g", { opacity: 0 });
    ui.hsec = [];
    for (let i = 0; i < 12; i++) {
      const p = s("path", { d: ring(rad(-90 - 15 + i * 30), rad(-90 + 15 + i * 30), 70, R), class: "sector" });
      ui.gH.appendChild(p); ui.hsec.push(p);
      const xy = at(104, rad(-90 + i * 30));
      ui.gH.appendChild(s("text", { x: xy[0].toFixed(1), y: (xy[1] + 6).toFixed(1), class: "w-glyph", "text-anchor": "middle", text: BRANCH[i] }));
      const hz = at(R + 13, rad(-90 - 15 + i * 30));
      ui.gH.appendChild(s("text", { x: hz[0].toFixed(1), y: (hz[1] + 4).toFixed(1), class: "hr", "text-anchor": "middle", text: String(mod(i * 2 - 1, 24)) }));
    }
    ui.hand = s("g", { class: "pointer" }, [
      s("line", { x1: CX, y1: CY, x2: CX, y2: CY - R - 4 }),
      s("path", { d: "M " + CX + " " + (CY - R - 14) + " l -7 11 l 14 0 Z" }),
    ]);
    ui.gH.appendChild(ui.hand);
    root.appendChild(ui.gH);

    root.appendChild(s("circle", { cx: CX, cy: CY, r: 62, class: "hub" }));
    ui.hubTop = s("text", { x: CX, y: CY - 14, class: "hub-small", "text-anchor": "middle" });
    ui.hubBig = s("text", { x: CX, y: CY + 22, class: "hub-big", "text-anchor": "middle" });
    root.appendChild(ui.hubTop); root.appendChild(ui.hubBig);

    // Right-hand side: the four pillars, then the element count.
    ui.cols = PILLARS.map((k, n) => {
      const x = COLX[n];
      const g = s("g", { opacity: 0 });
      const label = s("text", { x: x + COLW / 2, y: 96, class: "p-label", "text-anchor": "middle" });
      const box = s("rect", { x: x, y: 106, width: COLW, height: 150, rx: 4, class: "pcol" });
      const stem = s("text", { x: x + COLW / 2, y: 166, class: "p-han", "text-anchor": "middle" });
      const branch = s("text", { x: x + COLW / 2, y: 232, class: "p-han", "text-anchor": "middle" });
      const sub = s("text", { x: x + COLW / 2, y: 276, class: "p-sub", "text-anchor": "middle" });
      [label, box, stem, branch, sub].forEach((c) => g.appendChild(c));
      root.appendChild(g);
      return { g: g, label: label, box: box, stem: stem, branch: branch, sub: sub };
    });
    ui.barHead = s("text", { x: BAR_X, y: 310, class: "w-head" });
    root.appendChild(ui.barHead);
    root.appendChild(s("rect", { x: BAR_X, y: 320, width: BAR_W, height: 14, rx: 7, class: "ebar-bg" }));
    ui.segs = ELEMENTS.map((e) => { const r = s("rect", { x: BAR_X, y: 320, width: 0, height: 14, fill: COLOR[e] }); root.appendChild(r); return r; });
    ui.legs = ELEMENTS.map((e, k) => {
      const tx = s("text", { x: BAR_X + k * 52, y: 358, class: "e-leg" });
      tx.style.fill = COLOR[e];
      root.appendChild(tx); return tx;
    });
    ui.result = s("text", { x: BAR_X, y: 398, class: "w-result small" });
    root.appendChild(ui.result);
    host.appendChild(root);
  }

  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  const appear = (step, s, k) => (step > s ? 1 : step === s ? Math.max(0, Math.min(1, (k - 0.45) / 0.55)) : 0);

  function timeFacts(r) {
    const known = !!(r.time_known && r.time && r.bazi.hour);
    const clockBasis = r.settings && r.settings.time_basis === "clock";
    if (!known) return { known: false };
    const clock = minutesOf(r.time.input_local);
    // Shown shift is rounded to the minute; the sun time itself is read as given (hh:mm), as the hour uses it.
    const shift = clockBasis ? 0 : Math.round(r.time.true_solar_minus_clock_seconds / 60);
    const solar = clockBasis ? clock : minutesOf(r.time.true_solar_time);
    const move = mod(solar - clock + 720, 1440) - 720;
    const used = r.local_used && r.local_used.length >= 16 ? r.local_used : r.time.true_solar_time;
    return { known: true, clockBasis: clockBasis, clock: clock, solar: solar, move: move, shift: shift, used: used, usedMin: minutesOf(used) };
  }

  function draw(step, k, r, api) {
    if (!ui.cols || !r || !r.bazi) return;
    const t = api.t, b = r.bazi, tf = timeFacts(r);
    const sunL = b.sun_longitude_deg;
    const travel = mod(sunL - 315, 360);
    const cur = 315 + travel * (step === 1 ? k : step > 1 ? 1 : 0);

    setText(ui.head, t("pg.bazi.demo.h" + Math.min(step, 5)));

    // Group visibility per step.
    let oE = 0.25, o60 = 0, oH = 0;
    if (step === 1) oE = api.lerp(0.25, 1, Math.min(1, k * 2));
    else if (step === 2) oE = 1;
    else if (step === 3) { oE = 1 - k; o60 = k; }
    else if (step === 4) { o60 = 1 - k; oH = tf.known ? k : 0.35 * k; }
    else if (step >= 5) { oH = tf.known ? 0.45 : 0; oE = tf.known ? 0 : 0.2; }
    ui.gE.setAttribute("opacity", oE.toFixed(2));
    ui.g60.setAttribute("opacity", o60.toFixed(2));
    ui.gH.setAttribute("opacity", oH.toFixed(2));

    // Sun and its trail from Start of Spring.
    const sp = at(R, lonAngle(cur));
    ui.sun.setAttribute("cx", sp[0].toFixed(1)); ui.sun.setAttribute("cy", sp[1].toFixed(1));
    const moved = cur - 315;
    if (moved > 0.2) {
      ui.trail.setAttribute("d", "M " + pt(R, lonAngle(315)) + " A " + R + " " + R + " 0 " + (moved > 180 ? 1 : 0) + " 0 " + pt(R, lonAngle(cur)));
    } else ui.trail.setAttribute("d", "M 0 0");

    // The month sector the Sun is in.
    const m = Math.floor(b.month_opened_by.index / 2);
    ui.msec.forEach((p, i) => {
      const lit = step >= 2 && i === m;
      p.setAttribute("class", "sector" + (lit ? " lit" : ""));
      p.style.fill = lit ? COLOR[b.month.branch_element] + (step === 2 ? Math.round(20 + 40 * k).toString(16).padStart(2, "0") : "3c") : "";
    });

    // Sixty-day count.
    const ci = b.day.cycle_index;
    const reach = step === 3 ? Math.round(ci * k) : step > 3 ? ci : -1;
    ui.dots.forEach((c, j) => c.setAttribute("class", "d60" + (j === reach && (step > 3 || k > 0.98) ? " cur" : j <= reach ? " on" : "")));

    // Hour hand.
    const handDeg = tf.known ? (tf.usedMin / 60) * 15 : 0;
    const turn = step === 4 ? handDeg * k : step > 4 ? handDeg : 0;
    ui.hand.setAttribute("transform", "rotate(" + turn.toFixed(1) + " " + CX + " " + CY + ")");
    ui.hand.setAttribute("opacity", tf.known ? 1 : 0);
    const passing = mod(Math.round(turn / 30), 12);
    ui.hsec.forEach((p, i) => {
      const lit = tf.known && step >= 4 && i === (step > 4 || k > 0.98 ? b.hour.branch : passing);
      p.setAttribute("class", "sector" + (lit ? " lit" : ""));
    });

    // Hub and the working line.
    let top = "", big = "", line = "";
    if (step === 0) {
      if (tf.known) {
        top = t(k < 0.5 ? "pg.bazi.demo.clock" : "pg.bazi.demo.solar");
        big = clockText(k >= 1 ? tf.solar : tf.clock + tf.move * k);
        line = tf.clockBasis ? t("pg.bazi.demo.clock_basis", { clock: clockText(tf.clock) })
          : t("pg.bazi.demo.shift", { clock: clockText(tf.clock), solar: clockText(tf.solar), shift: signed(tf.move) });
      } else { top = t("pg.bazi.demo.notime"); big = "—"; }
    } else if (step === 1) {
      top = t("pg.bazi.demo.sun");
      big = Math.round(mod(cur, 360)) + "°";
      line = t("pg.bazi.demo.year", { deg: num1(sunL, api), year: b.bazi_year });
    } else if (step === 2) {
      top = t("pg.bazi.demo.month_hub");
      big = b.month_opened_by.name_zh;
      line = t("pg.bazi.demo.month", { term: b.month_opened_by.name_zh, branch: b.month.branch_zh });
    } else if (step === 3) {
      top = t("pg.bazi.demo.cycle", { n: Math.max(0, reach) + 1 });
      big = k > 0.98 ? b.day.name_zh : "";
      line = t("pg.bazi.demo.day", { n: ci + 1, pillar: b.day.name_zh });
    } else if (step === 4) {
      if (tf.known) {
        top = t("pg.bazi.demo.solar");
        big = clockText(tf.usedMin);
        line = t("pg.bazi.demo.hour", { time: clockText(tf.usedMin), branch: b.hour.branch_zh });
      } else { top = t("pg.bazi.demo.notime"); big = "?"; line = t("pg.bazi.demo.hour_unknown"); }
    } else {
      top = t("pg.bazi.demo.dm");
      big = b.day_master.stem_zh;
      line = "";
    }
    setText(ui.hubTop, top); setText(ui.hubBig, big); setText(ui.line, line);

    // Pillars.
    PILLARS.forEach((key, n) => {
      const c = ui.cols[n], p = b[key];
      const op = appear(step, n + 1, k);
      c.g.setAttribute("opacity", op.toFixed(2));
      setText(c.label, t("bazi.pillar." + key));
      const isDay = key === "day";
      c.box.setAttribute("class", "pcol" + (isDay && step >= 3 ? " day" : "") + (!p ? " unknown" : ""));
      if (p) {
        setText(c.stem, p.stem_zh); c.stem.style.fill = COLOR[p.stem_element];
        setText(c.branch, p.branch_zh); c.branch.style.fill = COLOR[p.branch_element];
        const god = p.ten_god_zh || "";
        setText(c.sub, isDay ? t("pg.bazi.demo.dm") : api.lang === "zh-hant" ? god.replace(/./g, (ch) => HANT[ch] || ch) : god);
        c.sub.setAttribute("class", "p-sub" + (isDay ? " dm" : ""));
      } else {
        setText(c.stem, "?"); c.stem.style.fill = "";
        setText(c.branch, "?"); c.branch.style.fill = "";
        setText(c.sub, t("pg.bazi.demo.hour_unknown"));
        c.sub.setAttribute("class", "p-sub dm");
      }
    });

    // Element count.
    const ev = b.elements_visible || {};
    const total = ELEMENTS.reduce((a, e) => a + (ev[e] || 0), 0) || 1;
    const fill = step === 5 ? k : step > 5 ? 1 : 0;
    let x = BAR_X;
    ELEMENTS.forEach((e, i) => {
      const w = (BAR_W * (ev[e] || 0) / total) * fill;
      ui.segs[i].setAttribute("x", x.toFixed(1)); ui.segs[i].setAttribute("width", w.toFixed(1));
      x += w;
      setText(ui.legs[i], EL_HAN[i] + " " + (ev[e] || 0));
      ui.legs[i].setAttribute("opacity", step >= 5 ? (ev[e] ? 1 : 0.35) : 0);
    });
    setText(ui.barHead, step >= 5 ? t("pg.bazi.demo.count") : "");
    setText(ui.result, step >= 3 ? t("pg.bazi.demo.dm") + ": " + dmValue(b.day_master.stem, api) : "");
    ui.result.setAttribute("opacity", step >= 3 ? (step === 3 ? appear(3, 3, k) : 1).toFixed(2) : 0);
  }

  function elementList(ev, api) {
    return ELEMENTS.filter((e) => ev[e]).map((e) => api.elementName(e) + " " + ev[e]).join(", ");
  }

  function steps(r, api) {
    if (!r || !r.bazi) return [];
    const t = api.t, b = r.bazi, tf = timeFacts(r);
    const out = [];
    if (!tf.known) out.push({ text: t("pg.bazi.step.1.notime"), seconds: 2 });
    else if (tf.clockBasis) out.push({ text: t("pg.bazi.step.1.clock", { clock: clockText(tf.clock) }), seconds: 2 });
    else out.push({ text: t("pg.bazi.step.1", { clock: clockText(tf.clock), solar: clockText(tf.solar), shift: signed(tf.move) }), seconds: 2.4 });
    out.push({ text: t("pg.bazi.step.2", { deg: num1(b.sun_longitude_deg, api), year: b.bazi_year, pillar: b.year.name_zh }), seconds: 3.4 });
    out.push({ text: t("pg.bazi.step.3", { term: b.month_opened_by.name_zh, date: api.formatClock(b.month_opened_by.beijing), pillar: b.month.name_zh }), seconds: 2.6 });
    out.push({ text: t("pg.bazi.step.4", { n: b.day.cycle_index + 1, pillar: b.day.name_zh, stem: b.day.stem_zh }), seconds: 3 });
    out.push(tf.known
      ? { text: t("pg.bazi.step.5", { time: clockText(tf.usedMin), branch: b.hour.branch_zh, pillar: b.hour.name_zh }), seconds: 2.8 }
      : { text: t("pg.bazi.step.5.unknown"), seconds: 2 });
    const ev = b.elements_visible || {};
    const n = ELEMENTS.reduce((a, e) => a + (ev[e] || 0), 0);
    out.push({ text: t("pg.bazi.step.6", { n: n, list: elementList(ev, api) }), seconds: 2.6 });
    return out;
  }

  // ------------------------------------------------------------ the page
  FTLesson.page({
    key: "bazi",
    path: "bazi/",
    items: items,
    sample: {
      date: "1990-08-15", time: "19:30",
      place: { name: "Pontianak", han_names: ["坤甸"], country: "ID", lat: -0.03194, lon: 109.325, tz: "Asia/Pontianak" },
      zone: "Asia/Pontianak",
    },

    mine: (r) => (r && r.bazi ? IDS[r.bazi.day_master.stem] : null),

    card: (item, api) => {
      const e = stemElement(item.i);
      return {
        num: String(item.i + 1).padStart(2, "0"),
        glyph: STEM[item.i],
        glyphClass: "el-" + e,
        kicker: api.t("polarity." + (isYang(item.i) ? "yang" : "yin")) + " · " + api.elementName(e),
        title: api.t("pg.bazi.card.title", { name: NAME[item.i], stem: STEM[item.i], element: api.elementName(e) }),
        sub: api.t("pg.bazi.img." + item.id),
      };
    },

    inspect: (item, api) => {
      const t = api.t, el = api.el;
      const r = api.record;
      const e = stemElement(item.i);
      const facts = el("div", { class: "facts" }, [
        el("div", { class: "fact" }, [el("small", { text: t("pg.bazi.i.stem") }), el("b", { class: "stem-big el-" + e, text: STEM[item.i] }), el("span", { text: PINYIN[item.i] })]),
        el("div", { class: "fact" }, [el("small", { text: t("pg.bazi.i.element") }), el("b", { class: "el-" + e, text: api.elementName(e) + " " + EL_HAN[Math.floor(item.i / 2)] })]),
        el("div", { class: "fact" }, [el("small", { text: t("pg.bazi.i.polarity") }), el("b", { text: t("polarity." + (isYang(item.i) ? "yang" : "yin")) })]),
        el("div", { class: "fact" }, [el("small", { text: t("pg.bazi.i.verse") }), el("b", { class: "verse", text: VERSE[item.i] })]),
      ]);

      // How each stem relates to this Day Master.
      const where = r && r.bazi ? stemsInChart(r.bazi) : null;
      const note = el("p", { class: "tg-note", "aria-live": "polite" });
      const rows = [];
      for (let k = 0; k < 10; k++) {
        const s = mod(item.i + k, 10);
        const god = tenGod(item.i, s);
        const info = where ? where[s] : null;
        let chart = "";
        if (where) {
          const parts = [];
          if (info && info.shown.length) parts.push(info.shown.map((p) => t("bazi.pillar." + p)).join(", "));
          if (info && info.hidden.length) parts.push(t("pg.bazi.i.hidden_in", { list: info.hidden.map((p) => t("bazi.pillar." + p)).join(", ") }));
          chart = parts.length ? parts.join(" · ") : "—";
        }
        const explain = t("rule.bazi.ten_god." + god);
        const tr = el("tr", { tabindex: "0", title: explain, class: (k === 0 ? "self" : "") + (info ? " in-chart" : "") || null }, [
          el("td", { class: "han-cell" }, [el("span", { class: "el-" + stemElement(s), text: STEM[s] }), el("small", { text: NAME[s] })]),
          el("td", { text: t("polarity." + (isYang(s) ? "yang" : "yin")) + " " + api.elementName(stemElement(s)) }),
          el("td", { text: t("tengod." + god) + (k === 0 ? " · " + t("pg.bazi.i.self") : "") }),
          where ? el("td", { class: "chart", text: chart }) : null,
        ]);
        const show = () => {
          rows.forEach((x) => x.classList.remove("picked"));
          tr.classList.add("picked");
          note.textContent = STEM[s] + " → " + STEM[item.i] + " · " + t("tengod." + god) + ": " + explain;
        };
        tr.addEventListener("click", show);
        tr.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); show(); } });
        rows.push(tr);
      }
      const table = el("div", { class: "tbl-wrap" }, [el("table", { class: "tbl tg-table" }, [
        el("thead", null, [el("tr", null, [
          el("th", { text: t("pg.bazi.i.col.stem") }), el("th", { text: t("pg.bazi.i.col.element") }), el("th", { text: t("pg.bazi.i.col.god") }),
          where ? el("th", { text: t("pg.bazi.i.col.chart") }) : null,
        ])]),
        el("tbody", null, rows),
      ])]);

      const mine = r && r.bazi ? r.bazi.day_master.stem : null;
      return [
        facts,
        el("h4", { text: t("pg.bazi.i.tradition") }),
        api.statementCard(statementFor(item)),
        el("h4", { text: t("pg.bazi.i.table", { stem: STEM[item.i] }) }),
        el("p", { class: "plain small", text: t("pg.bazi.i.table.hint") }),
        table,
        note,
        !where ? el("p", { class: "plain small", text: t("pg.bazi.i.nochart") })
          : mine !== item.i ? el("p", { class: "plain small", text: t("pg.bazi.i.table.other", { stem: STEM[item.i], mine: STEM[mine] }) }) : null,
      ];
    },

    tiles: (r, api) => {
      const t = api.t;
      if (!r || !r.bazi) return [{ label: t("pg.bazi.tile.dm"), value: "—", sub: t("lesson.tile.none") }];
      const b = r.bazi;
      const dm = b.day_master;
      const ev = b.elements_visible || {};
      const most = Math.max.apply(null, ELEMENTS.map((e) => ev[e] || 0));
      const top = ELEMENTS.filter((e) => (ev[e] || 0) === most);
      const absent = ELEMENTS.filter((e) => !ev[e]);
      let luck;
      if (!b.luck) luck = { label: t("pg.bazi.tile.luck"), value: "—", sub: t("bazi.luck.none") };
      else if (!r.time_known) luck = { label: t("pg.bazi.tile.luck"), value: t("pg.bazi.tile.luck.need_time"), sub: t("pg.bazi.tile.luck.approx", { age: num1(b.luck.start_age_years, api) }) };
      else luck = { label: t("pg.bazi.tile.luck"), value: t("pg.bazi.tile.luck.value", { age: num1(b.luck.start_age_years, api) }), sub: t("pg.bazi.tile.luck.sub", { year: b.luck.pillars[0].start_year }) };
      return [
        { label: t("pg.bazi.tile.dm"), value: dmValue(dm.stem, api), sub: t("pg.bazi.tile.dm.sub"), valueClass: "el-" + dm.element },
        {
          label: t("pg.bazi.tile.pillars"),
          value: PILLARS.map((k) => (b[k] ? b[k].name_zh : "—")).join(" "),
          sub: PILLARS.map((k) => t("bazi.pillar." + k)).join(" · "),
        },
        {
          label: t("pg.bazi.tile.elements"),
          value: top.map((e) => api.elementName(e)).join(" / ") + " × " + most,
          sub: absent.length ? t("bazi.elements.absent", { list: absent.map((e) => api.elementName(e)).join(", ") }) : t("pg.bazi.tile.all_present"),
          valueClass: top.length === 1 ? "el-" + top[0] : null,
        },
        luck,
      ];
    },

    demo: { setup: setup, steps: steps, draw: draw },

    // The professional chart (ft-bazi-pro.js) redraws whenever the reading or the language changes.
    after: (r, api) => { if (window.FTBaziPro) window.FTBaziPro.draw(r, api); },
  });
})();
