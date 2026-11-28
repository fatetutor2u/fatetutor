/*!
 * Fate Tutor lesson-page engine — ft-lesson.js
 *
 * One script drives every tradition page (/bazi/, /zodiac/, /numerology/, /weton/),
 * in the same spirit as KungfuTutor's lesson pages:
 *   - "Your birth" panel: a live calculator. Every change recalculates at once.
 *   - summary tiles, a row of cards to pick from (← / → keys, deep links #id),
 *   - an inspector for the chosen card, with "Mark as read" kept on this device,
 *   - a demo stage that shows, step by step, how the visitor's result is worked
 *     out: Play / Pause, ◂ / ▸ step, speed 0.5× / 1× / 2×, clickable step list.
 *
 * A page supplies a config through FTLesson.page({...}); see ft-page-zodiac.js.
 * All text goes in with textContent, never as HTML.
 *
 * Birth details never leave the device. They are kept in this browser tab
 * (sessionStorage) so they carry from page to page, and only in longer-lived
 * storage if the visitor ticks "Remember on this device".
 */
(function (w, d) {
  "use strict";

  const LANGS = ["en", "zh-hans", "zh-hant", "id", "ms"];
  const LOCALE = { en: "en-GB", "zh-hans": "zh-CN", "zh-hant": "zh-TW", id: "id-ID", ms: "ms-MY" };
  const HTML_LANG = { en: "en", "zh-hans": "zh-Hans", "zh-hant": "zh-Hant", id: "id", ms: "ms" };
  const FOLDER = { en: "", "zh-hans": "zh-hans/", "zh-hant": "zh-hant/", id: "id/", ms: "ms/" };
  const SITE_ROOT = new URL("../../", d.currentScript.src);
  const PUBLIC_ROOT = "https://www.fatetutor.com/";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const BIRTH_KEY = "ft.birth";
  const KEEP_KEY = "ft.birth.keep";

  const $ = (id) => d.getElementById(id);
  const $$ = (q) => Array.prototype.slice.call(d.querySelectorAll(q));

  const st = {
    lang: "en", dict: {}, fallback: {}, engine: null,
    birth: null, record: null, sample: null, place: null, zone: null,
    idx: 0, read: [], step: 0, progress: 0, playing: true, speed: 1, last: 0, hold: 0,
  };
  let cfg = null;

  // ------------------------------------------------------------ small helpers
  function t(key, params) {
    let text = st.dict[key];
    if (text === undefined) text = st.fallback[key];
    if (text === undefined) return key;
    if (params) text = text.replace(/\{(\w+)\}/g, (m, n) => (params[n] !== undefined ? String(params[n]) : m));
    return text;
  }

  function el(tag, attrs, children) {
    const node = d.createElement(tag);
    setAttrs(node, attrs);
    append(node, children);
    return node;
  }

  function svg(tag, attrs, children) {
    const node = d.createElementNS(SVG_NS, tag);
    setAttrs(node, attrs);
    append(node, children);
    return node;
  }

  function setAttrs(node, attrs) {
    if (!attrs) return;
    for (const key of Object.keys(attrs)) {
      const v = attrs[key];
      if (v === null || v === undefined || v === false) continue;
      if (key === "class") node.setAttribute("class", v);
      else if (key === "text") node.textContent = v;
      else node.setAttribute(key, v === true ? "" : v);
    }
  }

  function append(node, children) {
    for (const c of [].concat(children === undefined ? [] : children)) {
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === "string" || typeof c === "number" ? d.createTextNode(String(c)) : c);
    }
  }

  const store = {
    get(key, fallback) { try { const v = w.localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, value) { try { w.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ } },
    del(key) { try { w.localStorage.removeItem(key); } catch (e) { /* private mode */ } },
  };

  function formatDate(iso) {
    const p = iso.slice(0, 10).split("-").map(Number);
    return new Intl.DateTimeFormat(LOCALE[st.lang], { dateStyle: "long", timeZone: "UTC" }).format(new Date(Date.UTC(p[0], p[1] - 1, p[2])));
  }
  const formatClock = (iso) => (iso.length > 10 ? formatDate(iso) + ", " + iso.slice(11, 16) : formatDate(iso));
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const elementName = (code) => t("element." + code);
  const animalName = (english) => t("animal." + String(english).toLowerCase());

  // One traditional statement, with its label, review mark and source (same as the home page).
  function statementCard(s) {
    const text = el("p", { class: "text" });
    if (s.tradition === "numerology" && s.params && s.params.position) {
      text.appendChild(el("b", { text: t("numerology.position." + s.params.position, { number: s.params.number }) + ". " }));
    }
    text.appendChild(d.createTextNode(t("rule." + s.rule, s.params || {})));
    const source = el("p", { class: "source" }, [
      t("label.source") + ": " + t("source.kind." + s.source.kind) + " · " + s.source.work + " · " + s.source.passage,
    ]);
    if (s.source.quote) { source.appendChild(d.createTextNode(" ")); source.appendChild(el("q", { text: s.source.quote })); }
    return el("article", { class: "statement" }, [
      text,
      el("div", { class: "tags" }, [
        el("span", { class: "tag tradition", title: t("label.tradition.hint"), text: t("label.tradition") }),
        s.theme ? el("span", { class: "tag theme", text: t("theme." + s.theme) }) : null,
        el("span", { class: "tag review", title: t("label.review.hint"), text: t("label.review") }),
      ]),
      source,
    ]);
  }

  // ------------------------------------------------------------ languages
  function pickLanguage() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(fromUrl)) return fromUrl;
    const folder = d.documentElement.dataset.lang;
    if (LANGS.includes(folder) && folder !== "en") return folder;
    let saved = null;
    try { saved = w.localStorage.getItem("ft.lang"); } catch (e) { /* private mode */ }
    if (LANGS.includes(saved)) return saved;
    const nav = (navigator.language || "en").toLowerCase();
    if (nav.startsWith("zh")) return /tw|hk|mo|hant/.test(nav) ? "zh-hant" : "zh-hans";
    if (nav.startsWith("id")) return "id";
    if (nav.startsWith("ms")) return "ms";
    return "en";
  }

  async function loadDict(lang) {
    const r = await fetch(new URL("assets/i18n/" + lang + ".json", SITE_ROOT), { cache: "no-cache" });
    if (!r.ok) throw new Error("no wording for " + lang);
    return r.json();
  }

  function applyStatic() {
    d.documentElement.lang = HTML_LANG[st.lang];
    $$("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
    $$("[data-i18n-placeholder]").forEach((n) => { n.placeholder = t(n.dataset.i18nPlaceholder); });
    $$("[data-i18n-aria-label]").forEach((n) => { n.setAttribute("aria-label", t(n.dataset.i18nAriaLabel)); });
    $$("[data-i18n-content]").forEach((n) => { n.setAttribute("content", t(n.dataset.i18nContent)); });
    const canonical = d.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = PUBLIC_ROOT + FOLDER[st.lang] + cfg.path;
  }

  function showAddress() {
    if (!location.protocol.startsWith("http")) return;
    const target = new URL(FOLDER[st.lang] + cfg.path, SITE_ROOT);
    if (target.pathname !== location.pathname) {
      try { history.replaceState(null, "", target.pathname + location.hash); } catch (e) { /* stays */ }
    }
    // Links to other pages follow the language too.
    $$("a[data-page]").forEach((a) => {
      a.href = new URL(FOLDER[st.lang] + a.dataset.page, SITE_ROOT).href;
    });
  }

  async function setLanguage(lang) {
    st.lang = lang;
    try { st.dict = lang === "en" ? st.fallback : await loadDict(lang); } catch (e) { st.dict = st.fallback; }
    try { w.localStorage.setItem("ft.lang", lang); } catch (e) { /* private mode */ }
    $("lang").value = lang;
    applyStatic();
    showAddress();
    redrawAll();
  }

  // ------------------------------------------------------------ birth details
  function loadBirth() {
    let raw = null;
    try { raw = w.sessionStorage.getItem(BIRTH_KEY); } catch (e) { /* private mode */ }
    if (!raw && store.get(KEEP_KEY, false)) { try { raw = w.localStorage.getItem(BIRTH_KEY); } catch (e) { /* */ } }
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function saveBirth(b) {
    const raw = JSON.stringify(b);
    try { w.sessionStorage.setItem(BIRTH_KEY, raw); } catch (e) { /* private mode */ }
    if ($("b-keep") && $("b-keep").checked) { try { w.localStorage.setItem(BIRTH_KEY, raw); } catch (e) { /* */ } }
  }

  function forgetBirth() {
    try { w.sessionStorage.removeItem(BIRTH_KEY); } catch (e) { /* */ }
    store.del(BIRTH_KEY);
    store.del(KEEP_KEY);
    ["b-date", "b-time", "b-place", "b-name"].forEach((id) => { if ($(id)) $(id).value = ""; });
    if ($("b-notime")) $("b-notime").checked = false;
    if ($("b-sex")) $("b-sex").value = "";
    if ($("b-keep")) $("b-keep").checked = false;
    st.place = null; st.zone = null; st.birth = null; st.record = null;
    showPlace();
    recompute();
  }

  function fillForm(b) {
    if (!b) return;
    st.birth = b;
    if ($("b-date") && b.date) $("b-date").value = b.date;
    if ($("b-time") && b.time) $("b-time").value = b.time;
    if ($("b-notime")) $("b-notime").checked = !!b.notime;
    if ($("b-sex") && b.sex) $("b-sex").value = b.sex;
    if ($("b-name") && b.name) $("b-name").value = b.name;
    if (b.place) { st.place = b.place; st.zone = b.zone || b.place.tz; if ($("b-place")) $("b-place").value = placeLabel(b.place); }
    showPlace();
  }

  // Each page shows only the boxes its tradition needs. Details with no box on
  // this page (a name on the BaZi page, a time on the zodiac page …) are kept
  // exactly as they were entered on another page, never wiped.
  function readForm() {
    const kept = st.birth || loadBirth() || {};
    const v = (id, old) => ($(id) ? $(id).value.trim() : (old || ""));
    return {
      date: v("b-date", kept.date), time: v("b-time", kept.time),
      notime: $("b-notime") ? $("b-notime").checked : !!kept.notime,
      place: $("b-place") ? st.place : (kept.place || null), zone: $("b-place") ? st.zone : (kept.zone || null),
      sex: v("b-sex", kept.sex), name: v("b-name", kept.name),
      basis: kept.basis || "true_solar", daystart: kept.daystart || "23",
    };
  }

  function requestFor(b) {
    const req = { cmd: "reading", date: b.date, tz: b.zone || (b.place && b.place.tz) || "UTC", today: todayIso(),
      time_basis: b.basis || "true_solar", day_starts_at: b.daystart || "23" };
    if (b.place) { req.lon = b.place.lon; req.lat = b.place.lat; req.place = placeLabel(b.place); }
    if (b.time && !b.notime) req.time = b.time;
    if (b.sex) req.sex = b.sex;
    if (b.name) req.name = b.name;
    return req;
  }

  function todayIso() {
    const n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  }

  function recompute() {
    if (!st.engine) return;
    const b = readForm();
    $("b-error").textContent = "";
    st.record = null;
    if (b.date) {
      const y = Number(b.date.slice(0, 4));
      if (y < 1900 || y > 2100) {
        $("b-error").textContent = t("form.error.range");
      } else {
        try { st.record = st.engine.call(requestFor(b)); } catch (e) { $("b-error").textContent = String(e.message || e); }
      }
      st.birth = b;
      saveBirth(b);
    }
    if ($("b-time")) $("b-time").disabled = !!b.notime;
    const mine = st.record && cfg.mine ? cfg.mine(st.record, api) : null;
    if (mine !== null && mine !== undefined && st.autoJump) {
      const i = cfg.items.findIndex((it) => it.id === mine);
      if (i >= 0) st.idx = i;
    }
    st.autoJump = true;
    restartDemo();
    redrawAll();
  }

  // ------------------------------------------------------------ town search
  function placeLabel(p) { return p.name + (p.han_names && p.han_names.length ? " " + p.han_names[0] : "") + ", " + p.country; }

  function showPlace() {
    const out = $("b-chosen");
    if (!out) return;
    const p = st.place;
    out.textContent = p ? t("form.place.chosen", { lat: p.lat, lon: p.lon, tz: st.zone || p.tz }) : "";
  }

  function searchPlaces() {
    const list = $("b-places");
    const q = $("b-place").value.trim();
    st.place = null; st.zone = null;
    showPlace();
    list.textContent = "";
    if (!st.engine || q.length < 2) { list.hidden = true; return; }
    let hits = [];
    try { hits = st.engine.places(q, 8); } catch (e) { hits = []; }
    if (!hits.length) list.appendChild(el("li", { "aria-disabled": "true", text: t("form.place.none") }));
    hits.forEach((p, i) => {
      const li = el("li", { role: "option", id: "b-place-" + i, "aria-selected": "false" }, [el("span", { text: placeLabel(p) }), el("small", { text: p.tz })]);
      li.addEventListener("mousedown", (ev) => { ev.preventDefault(); choosePlace(p); });
      li.ftPlace = p;
      list.appendChild(li);
    });
    list.hidden = false;
  }

  function choosePlace(p) {
    st.place = p; st.zone = p.tz;
    $("b-place").value = placeLabel(p);
    $("b-places").hidden = true;
    showPlace();
    recompute();
  }

  function placeKeys(ev) {
    const list = $("b-places");
    if (list.hidden) return;
    const items = Array.prototype.slice.call(list.querySelectorAll('li[role="option"]'));
    if (!items.length) return;
    let i = items.findIndex((li) => li.getAttribute("aria-selected") === "true");
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      i = ev.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items.forEach((li, k) => li.setAttribute("aria-selected", k === i ? "true" : "false"));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      choosePlace(items[i < 0 ? 0 : i].ftPlace);
    } else if (ev.key === "Escape") {
      list.hidden = true;
    }
  }

  // ------------------------------------------------------------ cards + inspector
  const current = () => cfg.items[st.idx];
  const mineId = () => (st.record && cfg.mine ? cfg.mine(st.record, api) : null);

  function drawCards() {
    const host = $("cards");
    host.textContent = "";
    const mine = mineId();
    cfg.items.forEach((item, i) => {
      const c = cfg.card(item, api);
      const b = el("button", {
        type: "button", role: "tab", class: "lcard" + (i === st.idx ? " on" : "") + (item.id === mine ? " mine" : "") + (st.read.includes(item.id) ? " read" : ""),
        "aria-selected": i === st.idx ? "true" : "false", "data-id": item.id,
      }, [
        el("span", { class: "num", text: c.num }),
        c.glyph ? el("span", { class: "glyph" + (c.glyphClass ? " " + c.glyphClass : ""), text: c.glyph }) : null,
        c.pic ? el("img", { class: "pic", src: c.pic, alt: "", "aria-hidden": "true", width: "44", height: "44", loading: "lazy" }) : null,
        el("span", { class: "kicker", text: c.kicker || "" }),
        el("b", { text: c.title }),
        c.sub ? el("small", { text: c.sub }) : null,
        item.id === mine ? el("span", { class: "yours", text: t("lesson.yours") }) : null,
        st.read.includes(item.id) ? el("span", { class: "tick", "aria-label": t("lesson.read.done"), text: "✓" }) : null,
      ]);
      b.addEventListener("click", () => select(i, true));
      host.appendChild(b);
    });
    $("cards-count").textContent = t("lesson.count", { from: "01", to: String(cfg.items.length).padStart(2, "0") });
  }

  function select(i, fromClick) {
    st.idx = (i + cfg.items.length) % cfg.items.length;
    const id = current().id;
    try { history.replaceState(null, "", location.pathname + location.search + "#" + id); } catch (e) { /* */ }
    drawCards();
    drawInspector();
    if (cfg.demo && cfg.demo.onSelect) { cfg.demo.onSelect(current(), api); drawFrame(); }
    if (fromClick && w.innerWidth < 900) $("inspector").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function drawInspector() {
    const host = $("inspector-body");
    host.textContent = "";
    const item = current();
    const mine = mineId();
    const head = cfg.card(item, api);
    host.appendChild(el("div", { class: "i-head" }, [
      el("span", { class: "i-num", text: head.num }),
      el("div", null, [
        el("span", { class: "kicker", text: t("lesson.item_of", { n: st.idx + 1, total: cfg.items.length }) + (head.kicker ? " · " + head.kicker : "") }),
        el("h3", { text: head.title + (head.glyph && head.glyph !== head.title ? "  " + head.glyph : "") }),
        item.id === mine ? el("span", { class: "yours-note", text: t("lesson.yours.long") }) : null,
      ]),
    ]));
    append(host, cfg.inspect(item, api));
    const done = st.read.includes(item.id);
    const btn = $("i-read");
    btn.textContent = t(done ? "lesson.read.undo" : "lesson.read.mark");
    btn.classList.toggle("on", done);
    drawTiles();
  }

  function toggleRead() {
    const id = current().id;
    st.read = st.read.includes(id) ? st.read.filter((x) => x !== id) : st.read.concat([id]);
    store.set("ft." + cfg.key + ".read", st.read);
    drawCards();
    drawInspector();
  }

  function drawTiles() {
    const host = $("tiles");
    host.textContent = "";
    const tiles = (cfg.tiles ? cfg.tiles(st.record, api) : []).concat([{
      label: t("lesson.tile.read"), value: st.read.length + " / " + cfg.items.length, sub: t("lesson.tile.read.sub"),
    }]);
    tiles.forEach((x) => host.appendChild(el("div", { class: "tile" + (x.big ? " big" : "") }, [
      el("small", { text: x.label }), el("b", { class: x.valueClass || null, text: x.value }), x.sub ? el("span", { text: x.sub }) : null,
    ])));
  }

  // ------------------------------------------------------------ the demo player
  function demoRecord() { return st.record || st.sample; }

  function restartDemo() {
    if (!cfg.demo) return;
    st.steps = cfg.demo.steps(demoRecord(), api) || [];
    st.step = 0; st.progress = 0; st.hold = 0;
    st.playing = true;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches && st.steps.length) {
      // No animation wanted: show the finished working at once.
      st.playing = false; st.step = st.steps.length - 1; st.progress = 1;
    }
    drawSteps();
    updatePlay();
  }

  function drawSteps() {
    const host = $("steps");
    host.textContent = "";
    (st.steps || []).forEach((s, i) => {
      const li = el("li", { class: i === st.step ? "on" : i < st.step ? "done" : null }, [el("b", { text: String(i + 1) }), el("span", { text: s.text })]);
      li.addEventListener("click", () => { st.step = i; st.progress = 1; st.playing = false; updatePlay(); drawSteps(); drawFrame(); });
      host.appendChild(li);
    });
    const label = $("demo-who");
    if (label) label.textContent = st.record ? t("lesson.demo.yours", { date: formatDate(st.record.input.date) }) : t("lesson.demo.example", { date: formatDate(st.sample ? st.sample.input.date : "1990-08-15") });
  }

  function drawFrame() {
    if (!cfg.demo || !st.steps || !st.steps.length || !demoRecord()) return;
    cfg.demo.draw(st.step, ease(clamp01(st.progress)), demoRecord(), api);
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - (st.last || now)) / 1000);
    st.last = now;
    if (st.playing && st.steps && st.steps.length) {
      const dur = (st.steps[st.step].seconds || 2.4) / st.speed;
      if (st.progress < 1) {
        st.progress = Math.min(1, st.progress + dt / dur);
      } else {
        st.hold += dt;
        if (st.hold > 0.9 / st.speed) {
          st.hold = 0;
          if (st.step < st.steps.length - 1) { st.step += 1; st.progress = 0; drawSteps(); }
          else { st.playing = false; updatePlay(); }
        }
      }
      drawFrame();
    }
    w.requestAnimationFrame(tick);
  }

  function updatePlay() {
    const b = $("p-play");
    if (!b) return;
    const atEnd = st.steps && st.step === st.steps.length - 1 && st.progress >= 1;
    b.textContent = st.playing ? t("lesson.pause") : atEnd ? t("lesson.replay") : t("lesson.play");
  }

  function stepBy(delta) {
    if (!st.steps || !st.steps.length) return;
    st.playing = false;
    st.step = Math.max(0, Math.min(st.steps.length - 1, st.step + delta));
    st.progress = 1;
    updatePlay(); drawSteps(); drawFrame();
  }

  // ------------------------------------------------------------ start
  function redrawAll() {
    // Step sentences are rebuilt in the current language; the player keeps its place.
    if (cfg.demo && demoRecord() && st.steps) {
      st.steps = cfg.demo.steps(demoRecord(), api) || [];
      st.step = Math.min(st.step, Math.max(0, st.steps.length - 1));
    }
    drawCards();
    drawInspector();
    drawSteps();
    updatePlay();
    if (cfg.demo && cfg.demo.setup && !st.demoReady) { cfg.demo.setup($("stage"), api); st.demoReady = true; }
    drawFrame();
    if (cfg.after) cfg.after(st.record, api);
  }

  const api = {
    t, el, svg, append, formatDate, formatClock, elementName, animalName, statementCard, store,
    get record() { return st.record; }, get lang() { return st.lang; }, get engine() { return st.engine; },
    current, mineId, select: (id) => { const i = cfg.items.findIndex((x) => x.id === id); if (i >= 0) select(i, true); },
    lerp: (a, b, k) => a + (b - a) * k, clamp01, ease,
  };

  async function start(config) {
    cfg = config;
    st.read = store.get("ft." + cfg.key + ".read", []);
    st.fallback = await loadDict("en");
    st.lang = pickLanguage();
    try { st.dict = st.lang === "en" ? st.fallback : await loadDict(st.lang); } catch (e) { st.dict = st.fallback; }
    $("lang").value = st.lang;
    applyStatic();
    showAddress();

    const hash = decodeURIComponent(location.hash.slice(1));
    const fromHash = cfg.items.findIndex((x) => String(x.id) === hash);
    if (fromHash >= 0) { st.idx = fromHash; st.autoJump = false; } else { st.autoJump = true; }

    $("lang").addEventListener("change", (ev) => setLanguage(ev.target.value));
    ["b-date", "b-time", "b-notime", "b-sex"].forEach((id) => { if ($(id)) $(id).addEventListener("change", recompute); });
    if ($("b-name")) { let timer = null; $("b-name").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(recompute, 250); }); }
    if ($("b-place")) {
      let timer = null;
      $("b-place").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(searchPlaces, 140); });
      $("b-place").addEventListener("keydown", placeKeys);
      $("b-place").addEventListener("blur", () => setTimeout(() => { $("b-places").hidden = true; }, 120));
    }
    if ($("b-keep")) {
      $("b-keep").checked = !!store.get(KEEP_KEY, false);
      $("b-keep").addEventListener("change", (ev) => {
        if (ev.target.checked) { store.set(KEEP_KEY, true); if (st.birth) saveBirth(st.birth); }
        else { store.del(KEEP_KEY); store.del(BIRTH_KEY); }
      });
    }
    if ($("b-forget")) $("b-forget").addEventListener("click", forgetBirth);
    $("i-read").addEventListener("click", toggleRead);
    $("i-prev").addEventListener("click", () => select(st.idx - 1));
    $("i-next").addEventListener("click", () => select(st.idx + 1));
    $("p-play").addEventListener("click", () => {
      const atEnd = st.steps && st.step === st.steps.length - 1 && st.progress >= 1;
      if (!st.playing && atEnd) { st.step = 0; st.progress = 0; drawSteps(); }
      st.playing = !st.playing; st.last = 0; updatePlay();
    });
    $("p-prev").addEventListener("click", () => stepBy(-1));
    $("p-next").addEventListener("click", () => stepBy(1));
    $$("[data-speed]").forEach((b) => b.addEventListener("click", () => {
      st.speed = Number(b.dataset.speed);
      $$("[data-speed]").forEach((x) => x.classList.toggle("on", x === b));
    }));
    d.addEventListener("keydown", (ev) => {
      const tag = (ev.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (ev.key === "ArrowRight") { ev.preventDefault(); select(st.idx + 1); }
      else if (ev.key === "ArrowLeft") { ev.preventDefault(); select(st.idx - 1); }
      else if (ev.key === " " && ev.target === d.body) { ev.preventDefault(); $("p-play").click(); }
    });

    redrawAll();
    try {
      st.engine = await w.FTEngine.load(new URL("assets/wasm/ft.wasm", SITE_ROOT));
    } catch (e) {
      $("b-error").textContent = t("form.error.engine");
      return;
    }
    $("b-status").hidden = true;
    try { st.sample = st.engine.call(requestFor(cfg.sample)); } catch (e) { st.sample = null; }
    fillForm(loadBirth());
    recompute();
    w.requestAnimationFrame(tick);
    w.FTL = { st: st, t: t, api: api };   // for automated checks
  }

  w.FTLesson = { page: (config) => { if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", () => start(config)); else start(config); } };
})(window, document);
