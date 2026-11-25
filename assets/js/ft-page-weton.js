/*!
 * Fate Tutor — Javanese Weton page (weton/). Uses ft-lesson.js.
 * Cards: the 35 wetons (7-day week × 5-day market week). Demo: two wheels,
 * the 7-day week outside and the 5-day market week (pasaran) inside, are
 * counted on from a fixed date to the birth date; the two values (neptu) add up.
 */
(function () {
  "use strict";

  // Monday first, as in rust/ft-weton: [Indonesian, Javanese, neptu].
  const DAYS = [["Senin", "Senen", 4], ["Selasa", "Selasa", 3], ["Rabu", "Rebo", 7], ["Kamis", "Kemis", 8],
    ["Jumat", "Jemuwah", 6], ["Sabtu", "Setu", 9], ["Minggu", "Ngahad", 5]];
  // [name, neptu], in cycle order.
  const PASARAN = [["Legi", 5], ["Pahing", 9], ["Pon", 7], ["Wage", 4], ["Kliwon", 8]];
  const LOCALE = { en: "en-GB", "zh-hans": "zh-CN", "zh-hant": "zh-TW", id: "id-ID", ms: "ms-MY" };

  // Anchor, as in rust/ft-weton: 17 August 1945 (Indonesia's independence day) was Jumat Legi.
  const ANCHOR_ISO = "1945-08-17";
  const ANCHOR_DAY = 4;      // Jumat in DAYS
  const ANCHOR_PASARAN = 0;  // Legi in PASARAN

  const mod = (a, n) => ((a % n) + n) % n;
  const dayNumber = (iso) => { const p = iso.slice(0, 10).split("-").map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); };
  const isoOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  const ANCHOR = dayNumber(ANCHOR_ISO);

  /** Days from the anchor to a date (negative before 17 August 1945). */
  const daysFromAnchor = (iso) => dayNumber(iso) - ANCHOR;
  /** The weton of a date, counted from the anchor: both wheels move one step a day. */
  function wetonOf(iso) {
    const n = daysFromAnchor(iso);
    const d = mod(ANCHOR_DAY + n, 7), p = mod(ANCHOR_PASARAN + n, 5);
    return { n: n, d: d, p: p, name: DAYS[d][0] + " " + PASARAN[p][0], neptu: DAYS[d][2] + PASARAN[p][1] };
  }

  // The 35 cards, in the order the 35-day cycle actually runs, starting from the
  // anchor itself: card k is the weton that falls k days after 17 August 1945
  // (Jumat Legi, Sabtu Pahing, Minggu Pon, Senin Wage, Selasa Kliwon, Rabu Legi, …).
  // Starting there means a card's place in the row is exactly (days from the anchor)
  // mod 35, the same count the demo shows, and every 35 days the row starts again.
  const items = [];
  for (let k = 0; k < 35; k++) {
    const d = mod(ANCHOR_DAY + k, 7), p = mod(ANCHOR_PASARAN + k, 5);
    items.push({ id: (DAYS[d][0] + "-" + PASARAN[p][0]).toLowerCase(), k: k, d: d, p: p });
  }
  const idOf = (name) => String(name).toLowerCase().replace(/\s+/g, "-");
  const itemByName = (name) => items.find((x) => x.id === idOf(name));

  const fmtNum = (api, n) => new Intl.NumberFormat(LOCALE[api.lang] || "en-GB").format(n);
  // Weekday name in the visitor's language (13 August 1945 was a Monday).
  const weekday = (api, d) => new Intl.DateTimeFormat(LOCALE[api.lang] || "en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(1945, 7, 13 + d)));
  const wetonName = (api, d, p) => api.t("weton.value", { day: DAYS[d][0], pasaran: PASARAN[p][0] });

  function todayIso() {
    const n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  }

  /** The next `count` dates (from today on) on which card k falls. */
  function nextDates(k, count) {
    const today = dayNumber(todayIso());
    const first = today + mod(k - (today - ANCHOR), 35);
    const out = [];
    for (let i = 0; i < count; i++) out.push(isoOf(first + 35 * i));
    return out;
  }

  function statementFor(item) {
    const total = DAYS[item.d][2] + PASARAN[item.p][1];
    return {
      tradition: "weton", theme: "timing", rule: "weton.neptu",
      params: { neptu: total, weton: DAYS[item.d][0] + " " + PASARAN[item.p][0] },
      source: { kind: "classical_text", work: "Kitab Primbon Betaljemur Adammakna", passage: "Neptu dina lan pasaran (the day and market-day values)" },
    };
  }

  /**
   * The working shown in the demo. The count is done here from the anchor; it must
   * give the record's weton. If it ever does not, the record's values are shown.
   */
  function working(r) {
    const civil = r.weton.civil;
    const w = wetonOf(civil.date);
    let d = w.d, p = w.p;
    if (w.name !== civil.name) {
      d = DAYS.findIndex((x) => x[0] === civil.day_id);
      p = PASARAN.findIndex((x) => x[0] === civil.pasaran);
    }
    const r7 = mod(d - ANCHOR_DAY, 7), r5 = mod(p - ANCHOR_PASARAN, 5);
    return {
      n: w.n, d: d, p: p, r7: r7, r5: r5, civil: civil,
      dayNeptu: civil.day_neptu, pasNeptu: civil.pasaran_neptu, total: civil.neptu,
      evening: r.weton.after_sunset || null, next: (r.weton.next_dates || [])[0] || null,
    };
  }

  // ------------------------------------------------------------ the demo wheels
  const CX = 200, CY = 212;
  const OUT0 = 128, OUT1 = 182, IN0 = 66, IN1 = 112, HUB = 60;
  const ui = {};

  function sectorPath(i, n, r0, r1) {
    const half = 180 / n;
    const a0 = (-90 - half + i * 360 / n) * Math.PI / 180, a1 = (-90 + half + i * 360 / n) * Math.PI / 180;
    const p = (r, a) => (CX + r * Math.cos(a)).toFixed(1) + " " + (CY + r * Math.sin(a)).toFixed(1);
    return "M " + p(r0, a0) + " L " + p(r1, a0) + " A " + r1 + " " + r1 + " 0 0 1 " + p(r1, a1) + " L " + p(r0, a1) + " A " + r0 + " " + r0 + " 0 0 0 " + p(r0, a0) + " Z";
  }

  function ring(s, root, n, r0, r1, labels) {
    const out = { sectors: [], names: [], subs: [] };
    const g = s("g");
    const rm = (r0 + r1) / 2;
    for (let i = 0; i < n; i++) {
      const sec = s("path", { d: sectorPath(i, n, r0, r1), class: "sector" });
      g.appendChild(sec); out.sectors.push(sec);
      const a = (-90 + i * 360 / n) * Math.PI / 180;
      const x = (CX + rm * Math.cos(a)).toFixed(1), y = CY + rm * Math.sin(a);
      const nm = s("text", { x: x, y: (y - 2).toFixed(1), class: "w-day", "text-anchor": "middle", text: labels[i][0] });
      const sb = s("text", { x: x, y: (y + 12).toFixed(1), class: "w-sub", "text-anchor": "middle", text: labels[i][1] });
      g.appendChild(nm); g.appendChild(sb); out.names.push(nm); out.subs.push(sb);
    }
    root.appendChild(g);
    return out;
  }

  function setup(host, api) {
    const s = api.svg;
    host.textContent = "";
    const root = s("svg", { viewBox: "0 0 660 420", class: "demo-svg" });
    ui.week = ring(s, root, 7, OUT0, OUT1, DAYS.map((x) => [x[0], x[1] + " · " + x[2]]));
    ui.market = ring(s, root, 5, IN0, IN1, PASARAN.map((x) => [x[0], String(x[1])]));
    root.appendChild(s("circle", { cx: CX, cy: CY, r: HUB, class: "hub" }));
    ui.hubTop = s("text", { x: CX, y: CY - 12, class: "hub-small", "text-anchor": "middle" });
    ui.hubBig = s("text", { x: CX, y: CY + 20, class: "hub-big", "text-anchor": "middle" });
    root.appendChild(ui.hubTop); root.appendChild(ui.hubBig);
    // Two pointers: one outside the 7-day ring, one in the gap above the 5-day ring.
    ui.dayPtr = s("g", null, [s("path", { class: "pmark", d: "M " + CX + " " + (CY - OUT1 - 2) + " l -9 -14 l 18 0 Z" })]);
    ui.pasPtr = s("g", null, [s("path", { class: "pmark inner", d: "M " + CX + " " + (CY - IN1 - 1) + " l -7 -12 l 14 0 Z" })]);
    root.appendChild(ui.dayPtr); root.appendChild(ui.pasPtr);
    ui.legend = s("text", { x: CX, y: 412, class: "w-legend", "text-anchor": "middle" });
    root.appendChild(ui.legend);

    // Right-hand side: the working, line by line.
    ui.lines = [];
    for (let k = 0; k < 7; k++) {
      const tx = s("text", { x: 404, y: 70 + k * 38, class: k === 0 ? "w-head" : "w-line" });
      root.appendChild(tx); ui.lines.push(tx);
    }
    ui.result = s("text", { x: 404, y: 352, class: "w-result" });
    ui.resultSub = s("text", { x: 404, y: 382, class: "w-result-sub" });
    root.appendChild(ui.result); root.appendChild(ui.resultSub);
    host.appendChild(root);
  }

  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }

  function draw(step, k, r, api) {
    if (!ui.week || !r || !r.weton) return;
    const t = api.t;
    const w = working(r);
    const ev = w.evening;

    // Where each pointer stands, in steps from its own start (Jumat / Legi).
    let pd = 0, pp = 0;
    if (step === 2) pd = w.r7 * k; else if (step > 2) pd = w.r7;
    if (step === 3) pp = w.r5 * k; else if (step > 3) pp = w.r5;
    if (step === 5 && ev) { pd += k; pp += k; }
    ui.dayPtr.setAttribute("transform", "rotate(" + ((ANCHOR_DAY + pd) * 360 / 7).toFixed(2) + " " + CX + " " + CY + ")");
    ui.pasPtr.setAttribute("transform", "rotate(" + ((ANCHOR_PASARAN + pp) * 72).toFixed(2) + " " + CX + " " + CY + ")");
    const atDay = mod(ANCHOR_DAY + Math.round(pd), 7), atPas = mod(ANCHOR_PASARAN + Math.round(pp), 5);

    ui.week.sectors.forEach((sec, i) => {
      let c = "sector";
      if (i === atDay) c += step >= 4 && !(step === 5 && ev) ? " final" : " lit";
      else if (step === 5 && ev && i === w.d) c += " next";
      sec.setAttribute("class", c);
      ui.week.subs[i].setAttribute("class", "w-sub" + (step === 4 && i === w.d ? " on" : ""));
    });
    ui.market.sectors.forEach((sec, i) => {
      let c = "sector";
      if (i === atPas) c += step >= 4 && !(step === 5 && ev) ? " final" : " lit";
      else if (step === 5 && ev && i === w.p) c += " next";
      sec.setAttribute("class", c);
      ui.market.subs[i].setAttribute("class", "w-sub" + (step === 4 && i === w.p ? " on" : ""));
    });

    // Hub.
    if (step === 0) { setText(ui.hubTop, t("pg.weton.demo.hub.anchor")); setText(ui.hubBig, "1945"); }
    else if (step <= 3) { setText(ui.hubTop, t("pg.weton.demo.hub.days")); setText(ui.hubBig, (w.n < 0 ? "−" : "") + fmtNum(api, Math.round(Math.abs(w.n) * (step === 1 ? k : 1)))); }
    else if (step === 4 || ev) { setText(ui.hubTop, t("pg.weton.demo.hub.neptu")); setText(ui.hubBig, String(step === 5 && ev ? ev.neptu : Math.round(w.total * (step === 4 ? k : 1)))); }
    else { setText(ui.hubTop, t("pg.weton.demo.hub.cycle")); setText(ui.hubBig, "35"); }
    setText(ui.legend, t("pg.weton.demo.legend"));

    // Right-hand working.
    const days = fmtNum(api, Math.abs(w.n));
    const before = w.n < 0;
    const dayName = DAYS[w.d][0], pasName = PASARAN[w.p][0];
    setText(ui.lines[0], t("pg.weton.demo.h" + Math.min(step, 5)));
    setText(ui.lines[1], t("pg.weton.demo.anchor", { date: api.formatDate(ANCHOR_ISO) }));
    setText(ui.lines[2], step >= 1 ? t("pg.weton.demo.birth", { date: api.formatDate(w.civil.date) }) : "");
    setText(ui.lines[3], step >= 1 ? t(before ? "pg.weton.demo.days.before" : "pg.weton.demo.days.after", { days: days }) : "");
    setText(ui.lines[4], step >= 2 ? t(before ? "pg.weton.demo.mod7.before" : "pg.weton.demo.mod7", { days: days, rest: w.r7, day: step > 2 || k > 0.98 ? dayName : "…" }) : "");
    setText(ui.lines[5], step >= 3 ? t(before ? "pg.weton.demo.mod5.before" : "pg.weton.demo.mod5", { days: days, rest: w.r5, pasaran: step > 3 || k > 0.98 ? pasName : "…" }) : "");
    setText(ui.lines[6], step >= 4 ? t("pg.weton.demo.sum", { a: w.dayNeptu, b: w.pasNeptu, total: w.total }) : "");
    ui.lines[4].setAttribute("opacity", step === 2 ? Math.max(0.35, k) : 1);
    ui.lines[5].setAttribute("opacity", step === 3 ? Math.max(0.35, k) : 1);
    ui.lines[6].setAttribute("opacity", step === 4 ? k : 1);

    setText(ui.result, step >= 4 ? t("weton.value", { day: dayName, pasaran: pasName }) + " · " + w.total : "");
    ui.result.setAttribute("opacity", step >= 4 ? (step === 4 ? k : 1) : 0);
    let sub = "";
    if (step === 5) {
      if (ev) sub = t("pg.weton.demo.evening", { name: t("weton.value", { day: ev.day_id, pasaran: ev.pasaran }), neptu: ev.neptu });
      else if (w.next) sub = t("pg.weton.demo.next", { date: api.formatDate(w.next) });
    }
    setText(ui.resultSub, sub);
    ui.resultSub.setAttribute("opacity", step === 5 ? k : 0);
  }

  function steps(r, api) {
    if (!r || !r.weton) return [];
    const t = api.t;
    const w = working(r);
    const before = w.n < 0;
    const days = fmtNum(api, Math.abs(w.n));
    const anchor = api.formatDate(ANCHOR_ISO);
    const dayName = DAYS[w.d][0], pasName = PASARAN[w.p][0];
    const out = [
      { text: t("pg.weton.step.1", { anchor: anchor }), seconds: 2 },
      { text: t(before ? "pg.weton.step.2.before" : "pg.weton.step.2.after", { anchor: anchor, date: api.formatDate(w.civil.date), days: days }), seconds: 2.4 },
      { text: t(before ? "pg.weton.step.3.before" : "pg.weton.step.3.after", { days: days, rest: w.r7, day: dayName }), seconds: 3 },
      { text: t(before ? "pg.weton.step.4.before" : "pg.weton.step.4.after", { days: days, rest: w.r5, pasaran: pasName }), seconds: 3 },
      { text: t("pg.weton.step.5", { day: dayName, day_neptu: w.dayNeptu, pasaran: pasName, pasaran_neptu: w.pasNeptu, total: w.total, name: t("weton.value", { day: dayName, pasaran: pasName }) }), seconds: 2.6 },
    ];
    if (w.evening) {
      out.push({ text: t("pg.weton.step.6.evening", { name: t("weton.value", { day: w.evening.day_id, pasaran: w.evening.pasaran }), neptu: w.evening.neptu }), seconds: 2.6 });
    } else {
      out.push({ text: t("pg.weton.step.6.return", { date: w.next ? api.formatDate(w.next) : "—" }), seconds: 2.4 });
    }
    return out;
  }

  // ------------------------------------------------------------ the page
  FTLesson.page({
    key: "weton",
    path: "weton/",
    items: items,
    sample: { date: "1990-08-15", time: "19:30", zone: "Asia/Jakarta" },

    mine: (r) => (r && r.weton ? idOf(r.weton.civil.name) : null),

    card: (item, api) => ({
      num: String(item.k + 1).padStart(2, "0"),
      kicker: DAYS[item.d][1] + " " + PASARAN[item.p][0],
      title: wetonName(api, item.d, item.p),
      sub: api.t("pg.weton.card.neptu", { n: DAYS[item.d][2] + PASARAN[item.p][1] }),
    }),

    inspect: (item, api) => {
      const t = api.t, el = api.el;
      const r = api.record;
      const day = DAYS[item.d], pas = PASARAN[item.p];
      const total = day[2] + pas[1];
      const isMine = r && r.weton && idOf(r.weton.civil.name) === item.id;
      const isEvening = r && r.weton && r.weton.after_sunset && idOf(r.weton.after_sunset.name) === item.id;
      const recordDates = isMine ? (r.weton.next_dates || []) : [];
      const facts = el("div", { class: "facts" }, [
        el("div", { class: "fact" }, [el("small", { text: t("pg.weton.i.day") }), el("b", { text: day[0] }), el("span", { text: t("pg.weton.i.day.sub", { jv: day[1], weekday: weekday(api, item.d) }) })]),
        el("div", { class: "fact" }, [el("small", { text: t("pg.weton.i.pasaran") }), el("b", { text: pas[0] }), el("span", { text: t("pg.weton.i.pasaran.sub", { n: item.p + 1 }) })]),
        el("div", { class: "fact" }, [el("small", { text: t("pg.weton.i.neptu") }), el("b", { text: day[2] + " + " + pas[1] + " = " + total }), el("span", { text: t("pg.weton.i.neptu.sub", { day: day[0], pasaran: pas[0] }) })]),
        el("div", { class: "fact" }, [el("small", { text: t("pg.weton.i.order") }), el("b", { text: t("pg.weton.i.order.value", { n: item.k + 1 }) }), el("span", { text: t("pg.weton.i.order.sub", { date: api.formatDate(ANCHOR_ISO) }) })]),
      ]);
      const dates = el("div", { class: "chips" }, nextDates(item.k, 3).map((iso) =>
        el("span", { class: "ychip" + (recordDates.includes(iso) ? " mine" : ""), text: api.formatDate(iso) })));
      return [
        facts,
        isEvening ? el("p", { class: "weton-note", text: t("pg.weton.i.evening_note") }) : null,
        el("h4", { text: t("pg.weton.i.next", { name: wetonName(api, item.d, item.p) }) }),
        dates,
        el("p", { class: "plain small", text: t("pg.weton.i.cycle_note") }),
        el("h4", { text: t("pg.weton.i.tradition") }),
        api.statementCard(statementFor(item)),
      ];
    },

    tiles: (r, api) => {
      const t = api.t;
      if (!r || !r.weton) return [{ label: t("pg.weton.tile.weton"), value: "—", sub: t("lesson.tile.none") }];
      const c = r.weton.civil, e = r.weton.after_sunset, next = r.weton.next_dates || [];
      const out = [
        { label: t("pg.weton.tile.weton"), value: t("weton.value", { day: c.day_id, pasaran: c.pasaran }), sub: t("pg.weton.tile.weton.sub", { jv: c.day_jv + " " + c.pasaran, date: api.formatDate(c.date) }) },
        { label: t("weton.neptu"), value: String(c.neptu), sub: t("weton.neptu.how", { day: c.day_id, day_neptu: c.day_neptu, pasaran: c.pasaran, pasaran_neptu: c.pasaran_neptu, total: c.neptu }) },
      ];
      if (e) {
        out.push({
          label: t("pg.weton.tile.evening"),
          value: t("weton.value", { day: c.day_id, pasaran: c.pasaran }) + " / " + t("weton.value", { day: e.day_id, pasaran: e.pasaran }),
          sub: t("pg.weton.tile.evening.sub", { neptu: c.neptu, neptu2: e.neptu }),
        });
      }
      if (next.length) {
        out.push({ label: t("weton.next"), value: api.formatDate(next[0]), sub: next.length > 2 ? t("pg.weton.tile.next.sub", { d2: api.formatDate(next[1]), d3: api.formatDate(next[2]) }) : t("pg.weton.i.cycle_note") });
      }
      return out;
    },

    demo: { setup: setup, steps: steps, draw: draw },
  });

  // For automated checks in Node (no browser): the counting only.
  if (typeof module !== "undefined" && module.exports) module.exports = { wetonOf, items, nextDates, DAYS, PASARAN };
})();
