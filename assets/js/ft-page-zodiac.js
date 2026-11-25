/*!
 * Fate Tutor — Chinese zodiac page (zodiac/). Uses ft-lesson.js.
 * Cards: the 12 animals. Demo: a wheel of the 12 Earthly Branches turns to the
 * birth year's animal, then the year's Heavenly Stem gives the element.
 */
(function () {
  "use strict";

  const ANIMALS = ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"];
  const BRANCH = "子丑寅卯辰巳午未申酉戌亥";
  const PINYIN = ["zǐ", "chǒu", "yín", "mǎo", "chén", "sì", "wǔ", "wèi", "shēn", "yǒu", "xū", "hài"];
  const GLYPH_S = "鼠牛虎兔龙蛇马羊猴鸡狗猪";
  const GLYPH_T = "鼠牛虎兔龍蛇馬羊猴雞狗豬";
  const STEM = "甲乙丙丁戊己庚辛壬癸";
  // Fixed element of each Earthly Branch.
  const FIXED = ["water", "earth", "wood", "wood", "earth", "fire", "fire", "earth", "metal", "metal", "earth", "water"];
  const STEM_ELEMENT = ["wood", "wood", "fire", "fire", "earth", "earth", "metal", "metal", "water", "water"];
  const ELEMENTS = ["wood", "fire", "earth", "metal", "water"];
  const COLOR = { wood: "#5fd4a0", fire: "#ff8a6b", earth: "#e9c349", metal: "#cbd5e1", water: "#7bd0ff" };

  const items = ANIMALS.map((id, i) => ({ id: id, i: i }));
  const glyph = (api, i) => (api.lang === "zh-hant" ? GLYPH_T : GLYPH_S)[i];
  const mod = (a, n) => ((a % n) + n) % n;
  const animalIndex = (year) => mod(year - 4, 12);
  const stemIndex = (year) => mod(year - 4, 10);

  function yearsOf(i) {
    const now = new Date().getFullYear();
    const out = [];
    for (let y = now - 72; y <= now + 12; y++) if (animalIndex(y) === i) out.push(y);
    return out;
  }

  function statementFor(id, element) {
    return {
      tradition: "zodiac", theme: "character", rule: "zodiac.animal." + id, params: { element: element || "" },
      source: { kind: "popular_tradition", work: "Popular zodiac tradition (生肖)", passage: "No single classical source; the associations are folk tradition" },
    };
  }

  // ------------------------------------------------------------ the demo wheel
  const CX = 200, CY = 210, R = 168;
  const ui = {};

  function sectorPath(i, r0, r1) {
    const a0 = (-90 - 15 + i * 30) * Math.PI / 180, a1 = (-90 + 15 + i * 30) * Math.PI / 180;
    const p = (r, a) => (CX + r * Math.cos(a)).toFixed(1) + " " + (CY + r * Math.sin(a)).toFixed(1);
    return "M " + p(r0, a0) + " L " + p(r1, a0) + " A " + r1 + " " + r1 + " 0 0 1 " + p(r1, a1) + " L " + p(r0, a1) + " A " + r0 + " " + r0 + " 0 0 0 " + p(r0, a0) + " Z";
  }

  function setup(host, api) {
    const s = api.svg;
    host.textContent = "";
    const root = s("svg", { viewBox: "0 0 660 420", class: "demo-svg" });
    ui.sectors = []; ui.glyphs = []; ui.names = [];
    const wheel = s("g");
    for (let i = 0; i < 12; i++) {
      const sec = s("path", { d: sectorPath(i, 70, R), class: "sector" });
      wheel.appendChild(sec);
      ui.sectors.push(sec);
      const a = (-90 + i * 30) * Math.PI / 180;
      const g = s("text", { x: (CX + 128 * Math.cos(a)).toFixed(1), y: (CY + 128 * Math.sin(a) + 9).toFixed(1), class: "w-glyph", "text-anchor": "middle" });
      wheel.appendChild(g); ui.glyphs.push(g);
      const n = s("text", { x: (CX + 92 * Math.cos(a)).toFixed(1), y: (CY + 92 * Math.sin(a) + 4).toFixed(1), class: "w-branch", "text-anchor": "middle", text: BRANCH[i] });
      wheel.appendChild(n); ui.names.push(n);
    }
    root.appendChild(wheel);
    root.appendChild(s("circle", { cx: CX, cy: CY, r: 66, class: "hub" }));
    ui.hubTop = s("text", { x: CX, y: CY - 10, class: "hub-small", "text-anchor": "middle" });
    ui.hubBig = s("text", { x: CX, y: CY + 22, class: "hub-big", "text-anchor": "middle" });
    root.appendChild(ui.hubTop); root.appendChild(ui.hubBig);
    ui.pointer = s("g", { class: "pointer" }, [
      s("line", { x1: CX, y1: CY, x2: CX, y2: CY - R - 10 }),
      s("path", { d: "M " + CX + " " + (CY - R - 22) + " l -9 14 l 18 0 Z" }),
    ]);
    root.appendChild(ui.pointer);

    // Right-hand side: the working, line by line.
    ui.lines = [];
    for (let k = 0; k < 4; k++) {
      const tx = s("text", { x: 410, y: 96 + k * 58, class: k === 0 ? "w-head" : "w-line" });
      root.appendChild(tx); ui.lines.push(tx);
    }
    ui.chips = [];
    ELEMENTS.forEach((e, k) => {
      const g = s("g", { transform: "translate(" + (414 + k * 46) + " 330)" }, [
        s("circle", { r: 17, fill: COLOR[e], class: "chip" }),
        s("text", { y: 5, "text-anchor": "middle", class: "chip-t", text: "木火土金水"[k] }),
      ]);
      root.appendChild(g); ui.chips.push(g);
    });
    ui.result = s("text", { x: 410, y: 392, class: "w-result" });
    root.appendChild(ui.result);
    host.appendChild(root);
  }

  function setLine(k, text) { if (ui.lines[k].textContent !== text) ui.lines[k].textContent = text; }

  function draw(step, k, r, api) {
    if (!ui.sectors) return;
    const z = r.zodiac.by_lunar_new_year;
    const y = z.year;
    const target = animalIndex(y);
    const st = stemIndex(y);
    const t = api.t;
    for (let i = 0; i < 12; i++) ui.glyphs[i].textContent = glyph(api, i);

    // Pointer: still at the Rat until step 3, then turns to the animal.
    let turn = 0;
    if (step === 2) turn = target * 30 * k;
    else if (step > 2) turn = target * 30;
    ui.pointer.setAttribute("transform", "rotate(" + turn.toFixed(1) + " " + CX + " " + CY + ")");
    const passing = Math.round(turn / 30);
    ui.sectors.forEach((p, i) => {
      const lit = step >= 2 && (step > 2 ? i === target : i === passing);
      p.setAttribute("class", "sector" + (lit ? " lit" : "") + (step >= 4 && i === target ? " final" : ""));
      if (step >= 4 && i === target) p.style.fill = COLOR[z.element] + "33"; else p.style.fill = "";
    });

    ui.hubTop.textContent = step >= 1 ? t("pg.zodiac.demo.lunar_year") : t("pg.zodiac.demo.birth");
    ui.hubBig.textContent = step >= 1 ? String(y) : r.input.date.slice(0, 4);

    // Right-hand working.
    setLine(0, t("pg.zodiac.demo.h" + Math.min(step, 4)));
    setLine(1, step >= 0 ? api.formatDate(r.input.date) : "");
    setLine(2, step >= 1 ? t("pg.zodiac.demo.lunar", { year: r.lunar.year, month: r.lunar.month, day: r.lunar.day }) : "");
    setLine(3, step >= 2 ? t("pg.zodiac.demo.sum", { year: y, rest: Math.round(target * Math.min(1, step > 2 ? 1 : k)), animal: api.animalName(ANIMALS[target]) }) : "");
    if (step >= 3) {
      ui.lines[3].textContent = t("pg.zodiac.demo.sum", { year: y, rest: target, animal: api.animalName(ANIMALS[target]) });
    }
    ui.chips.forEach((c, i) => {
      const on = step >= 3 && ELEMENTS[i] === STEM_ELEMENT[st];
      c.setAttribute("opacity", step >= 3 ? (on ? 1 : 0.22) : 0.35);
      c.setAttribute("transform", "translate(" + (414 + i * 46) + " " + (330 - (on ? 10 * (step === 3 ? k : 1) : 0)) + ")");
    });
    ui.result.textContent = step >= 4 ? t("zodiac.value", { element: api.elementName(z.element), animal: api.animalName(z.animal) }) + " · " + STEM[st] + BRANCH[target] : "";
    ui.result.setAttribute("opacity", step >= 4 ? (step === 4 ? k : 1) : 0);
  }

  function steps(r, api) {
    if (!r) return [];
    const t = api.t;
    const z = r.zodiac.by_lunar_new_year;
    const y = z.year;
    const before = Number(r.input.date.slice(0, 4)) !== r.lunar.year;
    const out = [
      { text: t("pg.zodiac.step.1", { date: api.formatDate(r.input.date) }), seconds: 1.6 },
      { text: t(before ? "pg.zodiac.step.2.before" : "pg.zodiac.step.2.after", { year: r.lunar.year, month: r.lunar.month, day: r.lunar.day }), seconds: 2.2 },
      { text: t("pg.zodiac.step.3", { year: y, rest: animalIndex(y), animal: api.animalName(ANIMALS[animalIndex(y)]) }), seconds: 3.2 },
      { text: t("pg.zodiac.step.4", { year: y, digit: String(y).slice(-1), element: api.elementName(z.element) }), seconds: 2.4 },
      { text: t("pg.zodiac.step.5", { value: t("zodiac.value", { element: api.elementName(z.element), animal: api.animalName(z.animal) }), name: z.stem_branch }), seconds: 2 },
    ];
    const s = r.zodiac.by_start_of_spring;
    out.push({
      text: r.zodiac.conventions_differ
        ? t("pg.zodiac.step.6.diff", { other: t("zodiac.value", { element: api.elementName(s.element), animal: api.animalName(s.animal) }) })
        : t("pg.zodiac.step.6.same"),
      seconds: 2,
    });
    return out;
  }

  // ------------------------------------------------------------ the page
  FTLesson.page({
    key: "zodiac",
    path: "zodiac/",
    items: items,
    sample: { date: "1990-08-15", time: "19:30", place: null, zone: "Asia/Pontianak" },

    mine: (r) => (r ? r.zodiac.by_lunar_new_year.animal.toLowerCase() : null),

    card: (item, api) => ({
      num: String(item.i + 1).padStart(2, "0"),
      glyph: glyph(api, item.i),
      kicker: BRANCH[item.i] + " · " + api.elementName(FIXED[item.i]),
      title: api.animalName(item.id),
      sub: yearsOf(item.i).slice(-3, -1).concat(yearsOf(item.i).slice(-1)).join(" · "),
    }),

    inspect: (item, api) => {
      const t = api.t, el = api.el;
      const r = api.record;
      const mineYear = r && r.zodiac.by_lunar_new_year.animal.toLowerCase() === item.id ? r.zodiac.by_lunar_new_year.year : null;
      const facts = el("div", { class: "facts" }, [
        el("div", { class: "fact" }, [el("small", { text: t("pg.zodiac.i.branch") }), el("b", { class: "han", text: BRANCH[item.i] }), el("span", { text: PINYIN[item.i] })]),
        el("div", { class: "fact" }, [el("small", { text: t("pg.zodiac.i.fixed") }), el("b", { class: "el-" + FIXED[item.i], text: api.elementName(FIXED[item.i]) })]),
        el("div", { class: "fact" }, [el("small", { text: t("pg.zodiac.i.polarity") }), el("b", { text: t("polarity." + (item.i % 2 === 0 ? "yang" : "yin")) })]),
        el("div", { class: "fact" }, [el("small", { text: t("pg.zodiac.i.order") }), el("b", { text: t("pg.zodiac.i.order.value", { n: item.i + 1 }) })]),
      ]);
      const years = el("div", { class: "chips" }, yearsOf(item.i).map((y) => {
        const e = STEM_ELEMENT[stemIndex(y)];
        return el("span", { class: "ychip" + (y === mineYear ? " mine" : ""), title: api.elementName(e) }, [el("i", { class: "bg-" + e }), String(y) + " " + api.elementName(e)]);
      }));
      return [
        facts,
        el("h4", { text: t("pg.zodiac.i.years", { animal: api.animalName(item.id) }) }),
        years,
        el("p", { class: "plain small", text: t("pg.zodiac.i.newyear_note") }),
        el("h4", { text: t("pg.zodiac.i.tradition") }),
        api.statementCard(statementFor(item.id)),
      ];
    },

    tiles: (r, api) => {
      const t = api.t;
      if (!r) return [{ label: t("pg.zodiac.tile.animal"), value: "—", sub: t("lesson.tile.none") }];
      const z = r.zodiac.by_lunar_new_year, s = r.zodiac.by_start_of_spring;
      return [
        { label: t("pg.zodiac.tile.animal"), value: t("zodiac.value", { element: api.elementName(z.element), animal: api.animalName(z.animal) }), sub: t("zodiac.year", { name: z.stem_branch, year: z.year }), valueClass: "el-" + z.element },
        { label: t("pg.zodiac.tile.counts"), value: r.zodiac.conventions_differ ? api.animalName(z.animal) + " / " + api.animalName(s.animal) : t("pg.zodiac.tile.same"), sub: t(r.zodiac.conventions_differ ? "pg.zodiac.tile.diff.sub" : "pg.zodiac.tile.same.sub") },
        { label: t("pg.zodiac.tile.branch"), value: BRANCH[z.branch] + " " + PINYIN[z.branch], sub: t("pg.zodiac.tile.branch.sub", { element: api.elementName(FIXED[z.branch]) }) },
      ];
    },

    demo: { setup: setup, steps: steps, draw: draw },
  });
})();
