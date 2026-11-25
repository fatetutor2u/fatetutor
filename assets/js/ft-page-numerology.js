/*!
 * Fate Tutor — Numerology page (numerology/). Uses ft-lesson.js.
 * Cards: the numbers 1–9 and the master numbers 11, 22, 33.
 * Demo: the digits of the birth date fly together and are added down to the
 * Life Path; then the letters of the name become numbers; then the personal year.
 *
 * The numbers shown always come from the engine's record. The working is
 * re-derived here only to draw it; if it ever disagreed, the record's value wins.
 */
(function () {
  "use strict";

  const IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "11", "22", "33"];
  const MASTER = [11, 22, 33];
  const ALSO = { 11: 2, 22: 4, 33: 6 };
  const VOWELS = "AEIOU";
  const isMaster = (n) => MASTER.includes(n);

  const items = IDS.map((id, i) => ({ id: id, i: i, n: Number(id) }));

  // ------------------------------------------------------------ the arithmetic (same rules as ft-numerology)
  function digitSum(n) { let s = 0; n = Math.abs(n); while (n > 0) { s += n % 10; n = Math.floor(n / 10); } return s; }
  function reduce(n) { while (n > 9 && !isMaster(n)) n = digitSum(n); return n; }
  function chain(n) { const c = [n]; while (c[c.length - 1] > 9 && !isMaster(c[c.length - 1])) c.push(digitSum(c[c.length - 1])); return c; }
  function letterValue(ch) { const c = ch.toUpperCase().charCodeAt(0) - 65; return c >= 0 && c < 26 ? (c % 9) + 1 : 0; }
  function lettersFor(n) { let s = []; for (let c = 0; c < 26; c++) if ((c % 9) + 1 === n) s.push(String.fromCharCode(65 + c)); return s; }
  // "8 + 6 + 1 = 15 → 6"
  function sumText(terms) {
    const total = terms.reduce((a, b) => a + Number(b), 0);
    if (terms.length === 1) return chain(total).join(" → ");
    return terms.join(" + ") + " = " + chain(total).join(" → ");
  }
  // One part of the date (month or day): "08 = 8", "1 + 5 = 6", "11".
  function partText(str) {
    const n = Number(str);
    if (n <= 9) return str === String(n) ? String(n) : str + " = " + n;
    if (isMaster(n)) return String(n);
    return sumText(str.split(""));
  }
  function totalsFor(n) { const out = []; for (let x = 10; x < 100; x++) if (reduce(x) === n && x !== n) out.push(x); return out; }

  // Everything the demo shows, worked out from the date and name, checked against the record.
  const cache = { r: null, w: null };
  function work(r) {
    if (cache.r === r && cache.w) return cache.w;
    const num = r.numerology;
    const ds = r.input.date.slice(0, 10).split("-");
    const w = { ok: true, y: ds[0], m: ds[1], d: ds[2] };
    const check = (mine, theirs) => {
      if (mine === theirs) return true;
      w.ok = false;
      if (typeof console !== "undefined") console.warn("numerology demo: worked out", mine, "but the engine says", theirs, "- showing the engine's value");
      return false;
    };

    w.month = { digits: ds[1].split(""), value: reduce(Number(ds[1])), text: partText(ds[1]) };
    w.day = { digits: ds[2].split(""), value: reduce(Number(ds[2])), text: partText(ds[2]) };
    w.year = { digits: ds[0].split(""), value: reduce(digitSum(Number(ds[0]))), text: sumText(ds[0].split("")) };
    [["month", num.life_path_month], ["day", num.life_path_day], ["year", num.life_path_year]].forEach((p) => {
      if (!check(w[p[0]].value, p[1])) { w[p[0]].value = p[1]; w[p[0]].text = String(p[1]); }
    });
    const parts = [w.month.value, w.day.value, w.year.value];
    w.lp = { value: reduce(parts[0] + parts[1] + parts[2]), text: sumText(parts) };
    if (!check(w.lp.value, num.life_path)) { w.lp.value = num.life_path; w.lp.text = parts.join(" + ") + " → " + num.life_path; }

    const all = (ds[1] + ds[2] + ds[0]).split("");
    w.other = { value: reduce(all.reduce((a, b) => a + Number(b), 0)), text: sumText(all), differ: !!num.methods_differ };
    if (!check(w.other.value, num.life_path_other_method)) { w.other.value = num.life_path_other_method; w.other.text = String(num.life_path_other_method); }

    w.birthday = num.birthday;
    w.name = null;
    if (num.name) {
      const words = String(num.name.counted_as).split(" ").filter(Boolean);
      const letters = [], wordsOut = [];
      let pos = 0;
      words.forEach((word, wi) => {
        if (wi > 0) { letters.push(null); pos++; }
        const start = pos;
        let all = 0, vow = 0, con = 0;
        word.split("").forEach((ch) => {
          const v = letterValue(ch), vowel = VOWELS.includes(ch);
          letters.push({ ch: ch, v: v, vowel: vowel, word: wi });
          all += v; if (vowel) vow += v; else con += v;
          pos++;
        });
        wordsOut.push({ start: start, end: pos - 1, sum: all, value: reduce(all), text: "= " + chain(all).join(" → "), vow: reduce(vow), con: reduce(con) });
      });
      const ev = wordsOut.map((x) => x.value);
      const n = {
        letters: letters, words: wordsOut,
        expression: reduce(ev.reduce((a, b) => a + b, 0)), text: sumText(ev),
        soul: reduce(wordsOut.reduce((a, x) => a + x.vow, 0)), pers: reduce(wordsOut.reduce((a, x) => a + x.con, 0)),
      };
      if (!check(n.expression, num.name.expression)) { n.expression = num.name.expression; n.text = String(num.name.expression); }
      if (!check(n.soul, num.name.soul_urge)) n.soul = num.name.soul_urge;
      if (!check(n.pers, num.name.personality)) n.pers = num.name.personality;
      w.name = n;
    }
    w.nameSkipped = num.name_skipped || null;

    w.py = null;
    if (num.personal_year) {
      const cy = String(num.personal_year.year);
      const yv = reduce(digitSum(Number(cy)));
      const terms = [w.month.value, w.day.value, yv];
      w.py = { year: num.personal_year.year, digits: cy.split(""), yearValue: yv, yearText: sumText(cy.split("")), value: reduce(terms[0] + terms[1] + terms[2]), text: sumText(terms) };
      if (!check(w.py.value, num.personal_year.number)) { w.py.value = num.personal_year.number; w.py.text = terms.join(" + ") + " → " + num.personal_year.number; }
    }
    cache.r = r; cache.w = w;
    return w;
  }

  // The order of the demo steps for this record.
  function plan(r) {
    const w = work(r);
    const out = ["date", "month", "day", "year", "lp"];
    if (w.other.differ) out.push("other");
    if (w.name) out.push("name", "vowels"); else out.push("noname");
    if (w.py) out.push("py");
    return out;
  }

  // ------------------------------------------------------------ the demo stage
  const ui = {};
  const ROW1 = 112, ROW2 = 226, ROWS = 296, ROWT = 354;
  const GX = { month: 120, day: 290, year: 500 };

  function token(s, parent, r, res) {
    const g = s("g", { opacity: 0 });
    const c = s("circle", { r: r, class: "n-tok" + (res ? " res" : "") });
    const ring = s("circle", { r: r + 6, class: "n-ring", opacity: 0 });
    const tx = s("text", { y: 6, "text-anchor": "middle", class: "n-tok-t" });
    if (r > 24) {
      tx.setAttribute("style", "font-size:" + Math.round(r * 0.95) + "px");
      tx.setAttribute("y", String(Math.round(r * 0.33)));
    }
    g.appendChild(c); g.appendChild(ring); g.appendChild(tx);
    parent.appendChild(g);
    return { g: g, tx: tx, ring: ring };
  }

  function place(tok, x, y, scale, opacity, text, master) {
    tok.g.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ") scale(" + scale.toFixed(3) + ")");
    tok.g.setAttribute("opacity", Math.max(0, Math.min(1, opacity)).toFixed(3));
    if (text !== undefined && tok.tx.textContent !== String(text)) tok.tx.textContent = String(text);
    tok.ring.setAttribute("opacity", master ? "1" : "0");
  }
  const hide = (tok) => tok.g.setAttribute("opacity", "0");

  function text(s, parent, x, y, cls, anchor) {
    const n = s("text", { x: x, y: y, class: cls, "text-anchor": anchor || "middle" });
    parent.appendChild(n);
    return n;
  }
  function say(node, value, opacity) {
    if (node.textContent !== value) node.textContent = value;
    node.setAttribute("opacity", Math.max(0, Math.min(1, opacity === undefined ? 1 : opacity)).toFixed(3));
  }

  // x of digit j of n digits around a centre
  const spread = (cx, j, n, gap) => cx + (j - (n - 1) / 2) * gap;
  // progress of a sub-part of a step: k from a to b mapped to 0..1
  const part = (k, a, b) => Math.max(0, Math.min(1, (k - a) / (b - a)));

  function setup(host, api) {
    const s = api.svg;
    host.textContent = "";
    const root = s("svg", { viewBox: "0 0 660 420", class: "demo-svg" });
    ui.head = text(s, root, 24, 36, "w-head", "start");

    // Part A: the date and the Life Path.
    ui.a = s("g");
    ui.labels = {};
    ui.ghosts = {}; ui.flyers = {}; ui.works = {}; ui.results = {};
    ["month", "day", "year"].forEach((key) => {
      const n = key === "year" ? 4 : 2;
      ui.labels[key] = text(s, ui.a, GX[key], 72, "hub-small");
      ui.ghosts[key] = []; ui.flyers[key] = [];
      for (let j = 0; j < n; j++) ui.ghosts[key].push(text(s, ui.a, spread(GX[key], j, n, 40), ROW1 + 6, "n-ghost"));
      for (let j = 0; j < n; j++) ui.flyers[key].push(token(s, ui.a, 17, false));
      ui.works[key] = text(s, ui.a, GX[key], 172, "n-work");
      ui.results[key] = token(s, ui.a, 22, true);
    });
    ui.lpWork = text(s, ui.a, 330, ROWS, "n-work big");
    ui.lpFly = [token(s, ui.a, 22, true), token(s, ui.a, 22, true), token(s, ui.a, 22, true)];
    ui.lp = token(s, ui.a, 32, true);
    ui.lpLabel = text(s, ui.a, 330, 408, "hub-small");
    ui.other = token(s, ui.a, 32, true);
    ui.otherLabel = text(s, ui.a, 450, 408, "hub-small");
    root.appendChild(ui.a);

    // Part B: the name (built per record, since names differ in length).
    ui.b = s("g", { opacity: 0 });
    root.appendChild(ui.b);
    ui.nameKey = null;

    // Part C: the personal year.
    ui.c = s("g", { opacity: 0 });
    ui.cLabels = [text(s, ui.c, GX.month, 72, "hub-small"), text(s, ui.c, GX.day, 72, "hub-small"), text(s, ui.c, GX.year, 72, "hub-small")];
    ui.cMonth = token(s, ui.c, 22, true);
    ui.cDay = token(s, ui.c, 22, true);
    ui.cYearGhost = []; ui.cYearFly = [];
    for (let j = 0; j < 4; j++) ui.cYearGhost.push(text(s, ui.c, spread(GX.year, j, 4, 40), ROW1 + 6, "n-ghost"));
    for (let j = 0; j < 4; j++) ui.cYearFly.push(token(s, ui.c, 17, false));
    ui.cYearWork = text(s, ui.c, GX.year, 172, "n-work");
    ui.cYear = token(s, ui.c, 22, true);
    ui.cWork = text(s, ui.c, 330, ROWS, "n-work big");
    ui.cFly = [token(s, ui.c, 22, true), token(s, ui.c, 22, true), token(s, ui.c, 22, true)];
    ui.cResult = token(s, ui.c, 32, true);
    ui.cLabel = text(s, ui.c, 330, 408, "hub-small");
    root.appendChild(ui.c);

    // Notes (no name given, or a master number legend).
    ui.note = text(s, root, 330, 214, "n-note");
    ui.legend = s("g", { opacity: 0, transform: "translate(500 30)" }, [
      s("circle", { cx: 0, cy: 0, r: 8, class: "n-ring" }),
    ]);
    ui.legendText = s("text", { x: 14, y: 4, class: "hub-small", "text-anchor": "start" });
    ui.legend.appendChild(ui.legendText);
    root.appendChild(ui.legend);
    host.appendChild(root);
  }

  function buildName(n, api) {
    const s = api.svg;
    ui.b.textContent = "";
    const len = n.letters.length;
    const gap = Math.min(34, 600 / Math.max(1, len));
    const size = Math.max(9, Math.min(22, gap * 0.66));
    ui.bLetters = []; ui.bValues = []; ui.bFly = []; ui.bWords = [];
    n.letters.forEach((l, i) => {
      const x = spread(330, i, len, gap);
      if (!l) { ui.bLetters.push(null); ui.bValues.push(null); ui.bFly.push(null); return; }
      const lt = text(s, ui.b, x, ROW1, "n-letter");
      lt.setAttribute("style", "font-size:" + size.toFixed(1) + "px");
      lt.textContent = l.ch;
      ui.bLetters.push(lt);
      const vt = text(s, ui.b, x, ROW1 + size + 14, "n-work");
      vt.setAttribute("style", "font-size:" + Math.max(9, size * 0.8).toFixed(1) + "px");
      vt.textContent = String(l.v);
      ui.bValues.push(vt);
      const f = text(s, ui.b, x, ROW1 + size + 14, "n-work");
      f.setAttribute("style", "font-size:" + Math.max(9, size * 0.8).toFixed(1) + "px");
      f.textContent = String(l.v);
      ui.bFly.push({ node: f, x: x });
    });
    n.words.forEach((wd) => {
      const cx = (spread(330, wd.start, len, gap) + spread(330, wd.end, len, gap)) / 2;
      const wt = text(s, ui.b, cx, 214, "n-work");
      if (n.words.length > 3) wt.setAttribute("style", "font-size:" + Math.max(9, 14 - n.words.length).toFixed(0) + "px");
      ui.bWords.push({ node: wt, x: cx });
    });
    ui.bWork = text(s, ui.b, 330, ROWS - 18, "n-work big");
    ui.bExpr = token(s, ui.b, 32, true);
    ui.bExprLabel = text(s, ui.b, 330, 408, "hub-small");
    ui.bSoul = token(s, ui.b, 28, true);
    ui.bSoulLabel = text(s, ui.b, 210, 408, "hub-small");
    ui.bPers = token(s, ui.b, 28, true);
    ui.bPersLabel = text(s, ui.b, 450, 408, "hub-small");
  }

  function drawDate(kind, k, w, api) {
    const t = api.t;
    const order = ["date", "month", "day", "year", "lp", "other"];
    const at = order.indexOf(kind);
    say(ui.labels.month, t("pg.numerology.demo.month") + " " + w.m);
    say(ui.labels.day, t("pg.numerology.demo.day") + " " + w.d);
    say(ui.labels.year, t("pg.numerology.demo.year") + " " + w.y);
    ["month", "day", "year"].forEach((key, gi) => {
      const g = w[key];
      const mine = gi + 1;                       // the step that reduces this group
      const n = g.digits.length;
      g.digits.forEach((ch, j) => {
        const x0 = spread(GX[key], j, n, 40);
        say(ui.ghosts[key][j], ch, at === 0 ? part(k, j * 0.08 + gi * 0.2, j * 0.08 + gi * 0.2 + 0.3) * 0.5 : 0.5);
        const f = ui.flyers[key][j];
        if (at === 0) {
          const p = part(k, j * 0.08 + gi * 0.2, j * 0.08 + gi * 0.2 + 0.3);
          place(f, x0, ROW1 - 18 * (1 - p), 1, p, ch, false);
        } else if (at < mine) {
          place(f, x0, ROW1, 1, 1, ch, false);
        } else if (at === mine) {
          const p = part(k, 0.05, 0.6);
          place(f, api.lerp(x0, GX[key], p), api.lerp(ROW1, ROW2, p), 1 - 0.3 * p, 1 - part(k, 0.45, 0.65), ch, false);
        } else hide(f);
      });
      if (at < mine) { say(ui.works[key], "", 0); hide(ui.results[key]); }
      else {
        const p = at === mine ? part(k, 0.15, 0.5) : 1;
        say(ui.works[key], g.text, p);
        const q = at === mine ? part(k, 0.55, 0.85) : 1;
        place(ui.results[key], GX[key], ROW2, 0.5 + 0.5 * q, q, g.value, isMaster(g.value));
      }
    });
    // Life Path: the three results fly to the centre.
    const vals = [w.month.value, w.day.value, w.year.value];
    const xs = [GX.month, GX.day, GX.year];
    const lpX = at === 5 ? api.lerp(330, 210, k) : at > 5 ? 210 : 330;
    vals.forEach((v, i) => {
      if (at !== 4) { hide(ui.lpFly[i]); return; }
      const p = part(k, 0.05 + i * 0.06, 0.6 + i * 0.06);
      place(ui.lpFly[i], api.lerp(xs[i], 330, p), api.lerp(ROW2, ROWT, p), 1, p < 1 ? 1 : 0, v, false);
    });
    if (at < 4) { say(ui.lpWork, "", 0); hide(ui.lp); say(ui.lpLabel, "", 0); }
    else {
      say(ui.lpWork, at === 5 ? w.other.text : w.lp.text, at === 4 ? part(k, 0.1, 0.45) : at === 5 ? part(k, 0.3, 0.7) : 1);
      const q = at === 4 ? part(k, 0.65, 0.95) : 1;
      place(ui.lp, lpX, ROWT, 0.4 + 0.6 * q, q, w.lp.value, isMaster(w.lp.value));
      say(ui.lpLabel, t("numerology.life_path"), q);
      ui.lpLabel.setAttribute("x", lpX.toFixed(1));
    }
    if (at === 5) {
      const q = part(k, 0.55, 0.9);
      place(ui.other, 450, ROWT, 0.4 + 0.6 * q, q, w.other.value, isMaster(w.other.value));
      say(ui.otherLabel, t("pg.numerology.demo.other"), q);
      // every digit lights up: the whole date is added in one go
      ["month", "day", "year"].forEach((key) => ui.flyers[key].forEach(hide));
      ["month", "day", "year"].forEach((key) => ui.ghosts[key].forEach((g) => g.setAttribute("opacity", (0.5 + 0.5 * Math.sin(Math.PI * k)).toFixed(3))));
    } else { hide(ui.other); say(ui.otherLabel, "", 0); }
  }

  function drawName(kind, k, w, api) {
    const t = api.t, n = w.name;
    const vowels = kind === "vowels";
    const len = n.letters.length;
    n.letters.forEach((l, i) => {
      if (!l) return;
      const appear = vowels ? 1 : part(k, (i / len) * 0.4, (i / len) * 0.4 + 0.12);
      ui.bLetters[i].setAttribute("class", "n-letter" + (vowels ? (l.vowel ? " vowel" : " dim") : ""));
      ui.bLetters[i].setAttribute("opacity", vowels ? (l.vowel ? "1" : "0.45") : Math.min(1, appear * 2).toFixed(3));
      ui.bValues[i].setAttribute("opacity", vowels ? (l.vowel ? "1" : "0.3") : appear.toFixed(3));
      const f = ui.bFly[i];
      const wd = ui.bWords[l.word];
      if (!vowels && k > 0.45 && k < 0.75) {
        const p = part(k, 0.45, 0.7);
        f.node.setAttribute("x", api.lerp(f.x, wd.x, p).toFixed(1));
        f.node.setAttribute("y", api.lerp(ROW1 + 30, 214, p).toFixed(1));
        f.node.setAttribute("opacity", (1 - p).toFixed(3));
      } else f.node.setAttribute("opacity", "0");
    });
    n.words.forEach((wd, i) => say(ui.bWords[i].node, wd.text, vowels ? 0.35 : part(k, 0.62, 0.78)));
    say(ui.bWork, vowels ? "" : n.text, vowels ? 0 : part(k, 0.72, 0.86));
    if (vowels) {
      hide(ui.bExpr); say(ui.bExprLabel, "", 0);
      const q = part(k, 0.1, 0.5), q2 = part(k, 0.45, 0.85);
      place(ui.bSoul, 210, ROWT, 0.5 + 0.5 * q, q, n.soul, isMaster(n.soul));
      say(ui.bSoulLabel, t("pg.numerology.demo.soul"), q);
      place(ui.bPers, 450, ROWT, 0.5 + 0.5 * q2, q2, n.pers, isMaster(n.pers));
      say(ui.bPersLabel, t("pg.numerology.demo.pers"), q2);
    } else {
      hide(ui.bSoul); hide(ui.bPers); say(ui.bSoulLabel, "", 0); say(ui.bPersLabel, "", 0);
      const q = part(k, 0.82, 1);
      place(ui.bExpr, 330, ROWT, 0.4 + 0.6 * q, q, n.expression, isMaster(n.expression));
      say(ui.bExprLabel, t("pg.numerology.demo.expression"), q);
    }
  }

  function drawYear(k, w, api) {
    const t = api.t, py = w.py;
    say(ui.cLabels[0], t("pg.numerology.demo.month") + " " + w.m);
    say(ui.cLabels[1], t("pg.numerology.demo.day") + " " + w.d);
    say(ui.cLabels[2], t("pg.numerology.demo.this_year", { year: py.year }));
    place(ui.cMonth, GX.month, ROW2, 1, 1, w.month.value, isMaster(w.month.value));
    place(ui.cDay, GX.day, ROW2, 1, 1, w.day.value, isMaster(w.day.value));
    py.digits.forEach((ch, j) => {
      const x0 = spread(GX.year, j, 4, 40);
      say(ui.cYearGhost[j], ch, 0.5);
      const p = part(k, 0.05, 0.35);
      if (k < 0.4) place(ui.cYearFly[j], api.lerp(x0, GX.year, p), api.lerp(ROW1, ROW2, p), 1 - 0.3 * p, 1 - part(k, 0.28, 0.38), ch, false);
      else hide(ui.cYearFly[j]);
    });
    say(ui.cYearWork, py.yearText, part(k, 0.1, 0.3));
    const q0 = part(k, 0.3, 0.42);
    place(ui.cYear, GX.year, ROW2, 0.5 + 0.5 * q0, q0, py.yearValue, isMaster(py.yearValue));
    const vals = [w.month.value, w.day.value, py.yearValue], xs = [GX.month, GX.day, GX.year];
    vals.forEach((v, i) => {
      const p = part(k, 0.45 + i * 0.04, 0.75 + i * 0.04);
      place(ui.cFly[i], api.lerp(xs[i], 330, p), api.lerp(ROW2, ROWT, p), 1, p > 0 && p < 1 ? 1 : 0, v, false);
    });
    say(ui.cWork, py.text, part(k, 0.5, 0.7));
    const q = part(k, 0.8, 1);
    place(ui.cResult, 330, ROWT, 0.4 + 0.6 * q, q, py.value, isMaster(py.value));
    say(ui.cLabel, t("numerology.personal_year", { year: py.year }), q);
  }

  function draw(step, k, r, api) {
    if (!ui.head || !r || !r.numerology) return;
    const w = work(r);
    const kinds = plan(r);
    const kind = kinds[Math.min(step, kinds.length - 1)];
    const t = api.t;
    say(ui.head, t("pg.numerology.demo.h." + kind));
    const dateKinds = ["date", "month", "day", "year", "lp", "other"];
    const inDate = dateKinds.includes(kind);
    const at = kinds.indexOf(kind);

    ui.a.setAttribute("opacity", inDate ? "1" : "0");
    if (inDate) drawDate(kind, k, w, api);

    const nameOn = kind === "name" || kind === "vowels";
    if (w.name) {
      const key = w.name.letters.map((l) => (l ? l.ch : " ")).join("");
      if (ui.nameKey !== key) { buildName(w.name, api); ui.nameKey = key; }
    } else if (ui.nameKey !== null) { ui.b.textContent = ""; ui.nameKey = null; }
    ui.b.setAttribute("opacity", nameOn ? (kind === "name" ? part(k, 0.05, 0.25) : 1).toFixed(3) : "0");
    if (nameOn && w.name) drawName(kind, k, w, api);

    ui.c.setAttribute("opacity", kind === "py" ? part(k, 0, 0.2).toFixed(3) : "0");
    if (kind === "py") drawYear(k, w, api);

    if (kind === "noname") say(ui.note, w.nameSkipped === "not_latin_letters" ? t("pg.numerology.demo.latin") : t("pg.numerology.demo.noname"), part(k, 0.2, 0.5));
    else say(ui.note, "", 0);

    // Legend for the gold ring, shown once a master number is on screen.
    let onScreen = [];
    if (inDate) {
      if (at >= 1) onScreen.push(w.month.value);
      if (at >= 2) onScreen.push(w.day.value);
      if (at >= 3) onScreen.push(w.year.value);
      if (at >= 4) onScreen.push(w.lp.value);
      if (kind === "other") onScreen.push(w.other.value);
    } else if (kind === "name") onScreen = [w.name.expression];
    else if (kind === "vowels") onScreen = [w.name.soul, w.name.pers];
    else if (kind === "py") onScreen = [w.month.value, w.day.value, w.py.yearValue, w.py.value];
    const shownMaster = onScreen.some(isMaster);
    say(ui.legendText, t("pg.numerology.demo.master"));
    ui.legend.setAttribute("opacity", shownMaster ? "1" : "0");
  }

  function steps(r, api) {
    if (!r || !r.numerology) return [];
    const t = api.t, w = work(r);
    const gap = String(api.lang).startsWith("zh") ? "" : " ";
    const kept = (n) => (isMaster(n) ? gap + t("pg.numerology.step.kept", { n: n }) : "");
    const line = {
      date: () => t("pg.numerology.step.date", { date: api.formatDate(r.input.date), month: w.m, day: w.d, year: w.y }),
      month: () => t("pg.numerology.step.month", { work: w.month.text }) + kept(w.month.value),
      day: () => t("pg.numerology.step.day", { work: w.day.text }) + kept(w.day.value),
      year: () => t("pg.numerology.step.year", { work: w.year.text }),
      lp: () => t("pg.numerology.step.lp", { work: w.lp.text, n: w.lp.value }) + kept(w.lp.value),
      other: () => t("pg.numerology.step.other", { work: w.other.text, n: w.other.value }) + kept(w.other.value),
      name: () => t("pg.numerology.step.name", { name: r.numerology.name.counted_as, work: w.name.text, n: w.name.expression }) + kept(w.name.expression),
      vowels: () => t("pg.numerology.step.vowels", { soul: w.name.soul, pers: w.name.pers }),
      noname: () => (w.nameSkipped === "not_latin_letters" ? t("numerology.name.not_latin_letters") : t("pg.numerology.step.noname")),
      py: () => t("pg.numerology.step.py", { year: w.py.year, ywork: w.py.yearText, work: w.py.text, n: w.py.value }) + kept(w.py.value),
    };
    const secs = { date: 2.2, month: 2.6, day: 2.6, year: 3, lp: 3.2, other: 2.8, name: 4.2, vowels: 2.8, noname: 2, py: 4 };
    return plan(r).map((kind) => ({ text: line[kind](), seconds: secs[kind] }));
  }

  // ------------------------------------------------------------ the inspector
  function statementFor(n) {
    return {
      tradition: "numerology", theme: "character", rule: "numerology.number." + n, params: { number: n },
      source: { kind: "modern_system", work: "Modern Pythagorean numerology (20th century)", passage: "Life Path number" },
    };
  }

  // Where a number sits in the visitor's chart.
  function whereIn(r, n, api) {
    const t = api.t, num = r.numerology, out = [];
    const add = (label, v) => {
      if (v === n) out.push({ label: label, v: v });
      else if (ALSO[v] === n) out.push({ label: label + " · " + t("pg.numerology.i.where.as", { n: v }), v: v });
    };
    add(t("numerology.life_path"), num.life_path);
    if (num.methods_differ) add(t("pg.numerology.i.where.other"), num.life_path_other_method);
    add(t("numerology.birthday"), num.birthday);
    if (num.name) {
      add(t("numerology.expression"), num.name.expression);
      add(t("numerology.soul_urge"), num.name.soul_urge);
      add(t("numerology.personality"), num.name.personality);
    }
    if (num.personal_year) add(t("numerology.personal_year", { year: num.personal_year.year }), num.personal_year.number);
    return out;
  }

  // ------------------------------------------------------------ the page
  FTLesson.page({
    key: "numerology",
    path: "numerology/",
    items: items,
    sample: { date: "1990-08-15", name: "Siti Rahma", zone: "UTC" },

    mine: (r) => (r && r.numerology ? String(r.numerology.life_path) : null),

    card: (item, api) => {
      const t = api.t, m = isMaster(item.n);
      return {
        num: String(item.i + 1).padStart(2, "0"),
        glyph: item.id,
        glyphClass: "n-glyph" + (m ? " n-master" : ""),
        kicker: m ? t("pg.numerology.card.master") : lettersFor(item.n).join(" · "),
        title: t("pg.numerology.n." + item.id + ".short"),
        sub: m ? t("pg.numerology.card.also", { n: ALSO[item.n] }) : null,
      };
    },

    inspect: (item, api) => {
      const t = api.t, el = api.el, n = item.n, m = isMaster(n);
      const r = api.record;
      const totals = totalsFor(n);
      const facts = [
        el("div", { class: "fact" }, [el("small", { text: t("pg.numerology.i.kind") }), el("b", { text: t(m ? "pg.numerology.i.kind.master" : "pg.numerology.i.kind.single") })]),
        el("div", { class: "fact" }, [
          el("small", { text: t("pg.numerology.i.letters") }),
          el("b", { text: m ? "—" : lettersFor(n).join(" · ") }),
          el("span", { text: t(m ? "pg.numerology.i.letters.master" : "pg.numerology.i.letters.note") }),
        ]),
        el("div", { class: "fact" }, [
          el("small", { text: t("pg.numerology.i.totals", { n: n }) }),
          el("b", { text: totals.length ? totals.slice(0, 5).join(" · ") : "—" }),
          totals.length ? null : el("span", { text: t("pg.numerology.i.totals.none") }),
        ]),
      ];
      if (m) facts.push(el("div", { class: "fact" }, [el("small", { text: t("pg.numerology.i.also") }), el("b", { text: String(ALSO[n]) }), el("span", { text: t("pg.numerology.i.also.note", { n: n, d: ALSO[n] }) })]));
      const out = [
        el("div", { class: "facts" }, facts),
        el("h4", { text: t("pg.numerology.i.tradition") }),
        api.statementCard(statementFor(n)),
        el("h4", { text: t("pg.numerology.i.where") }),
      ];
      if (!r || !r.numerology) out.push(el("p", { class: "plain small", text: t("pg.numerology.i.where.empty") }));
      else {
        const spots = whereIn(r, n, api);
        if (!spots.length) out.push(el("p", { class: "plain small", text: t("pg.numerology.i.where.none", { n: n }) }));
        else out.push(el("div", { class: "chips n-where" }, spots.map((x) => el("span", { class: "ychip" + (x.v === n ? " mine" : "") }, [x.label + ": " + x.v]))));
        if (!r.numerology.name) out.push(el("p", { class: "plain small", text: t("numerology.name." + (r.numerology.name_skipped || "not_given")) }));
      }
      return out;
    },

    tiles: (r, api) => {
      const t = api.t;
      if (!r || !r.numerology) return [{ label: t("numerology.life_path"), value: "—", sub: t("lesson.tile.none") }];
      const n = r.numerology;
      const how = t("numerology.life_path.how", { month: n.life_path_month, day: n.life_path_day, year: n.life_path_year, total: n.life_path });
      const tiles = [
        { label: t("numerology.life_path"), value: String(n.life_path) + (n.methods_differ ? " / " + n.life_path_other_method : ""),
          sub: how + (n.methods_differ ? " · " + t("pg.numerology.tile.other", { number: n.life_path_other_method }) : ""), big: true },
        { label: t("numerology.birthday"), value: String(n.birthday), sub: t("pg.numerology.tile.birthday.sub", { day: Number(r.input.date.slice(8, 10)) }) },
      ];
      if (n.name) tiles.push({ label: t("numerology.expression"), value: String(n.name.expression), sub: t("pg.numerology.tile.name.sub", { soul: n.name.soul_urge, pers: n.name.personality }) });
      else tiles.push({ label: t("numerology.expression"), value: "—", sub: t(n.name_skipped === "not_latin_letters" ? "numerology.name.not_latin_letters" : "pg.numerology.tile.name.add") });
      if (n.personal_year) tiles.push({ label: t("numerology.personal_year", { year: n.personal_year.year }), value: String(n.personal_year.number), sub: t("pg.numerology.tile.py.sub") });
      return tiles;
    },

    demo: { setup: setup, steps: steps, draw: draw },
  });
})();
