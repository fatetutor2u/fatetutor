// Fate Tutor page logic: languages, the birth form, and drawing the Destiny Record.
//
// The engine (ft-engine.js + ft.wasm) produces facts and statement keys. This
// file only turns them into words in the visitor's language. All text is set
// with textContent, never as HTML, so nothing typed into the form can run.
(function () {
  "use strict";

  const LANGS = ["en", "zh-hans", "zh-hant", "id", "ms"];
  const LOCALE = { en: "en-GB", "zh-hans": "zh-CN", "zh-hant": "zh-TW", id: "id-ID", ms: "ms-MY" };
  const HTML_LANG = { en: "en", "zh-hans": "zh-Hans", "zh-hant": "zh-Hant", id: "id", ms: "ms" };
  const ELEMENTS = ["wood", "fire", "earth", "metal", "water"];

  // Each language has its own address: English at the top, the others in a
  // folder. The shared files are found from this script's own address, so the
  // page works the same from the top and from inside a language folder.
  const FOLDER = { en: "", "zh-hans": "zh-hans/", "zh-hant": "zh-hant/", id: "id/", ms: "ms/" };
  const SITE_ROOT = new URL("../../", document.currentScript.src);
  const PUBLIC_ROOT = "https://www.fatetutor.com/";

  const state = { lang: "en", dict: {}, fallback: {}, engine: null, place: null, zone: null, record: null, expert: false };
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------ languages
  function t(key, params) {
    let text = state.dict[key];
    if (text === undefined) text = state.fallback[key];
    if (text === undefined) return key;
    if (params) {
      text = text.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined ? String(params[name]) : m));
    }
    return text;
  }

  function pickLanguage() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(fromUrl)) return fromUrl;
    // A language folder (/id/, /zh-hans/ …) was asked for by address: keep it.
    const folder = document.documentElement.dataset.lang;
    if (LANGS.includes(folder) && folder !== "en") return folder;
    let saved = null;
    try { saved = localStorage.getItem("ft.lang"); } catch (e) { /* private mode */ }
    if (LANGS.includes(saved)) return saved;
    const nav = (navigator.language || "en").toLowerCase();
    if (nav.startsWith("zh")) return /tw|hk|mo|hant/.test(nav) ? "zh-hant" : "zh-hans";
    if (nav.startsWith("id")) return "id";
    if (nav.startsWith("ms")) return "ms";
    return "en";
  }

  async function loadDict(lang) {
    // "no-cache" asks the server whether the wording changed (cheap), so a new
    // page never shows an old wording file's missing sentences.
    const response = await fetch(new URL("assets/i18n/" + lang + ".json", SITE_ROOT), { cache: "no-cache" });
    if (!response.ok) throw new Error("no wording for " + lang);
    return response.json();
  }

  function applyStatic() {
    document.documentElement.lang = HTML_LANG[state.lang];
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      if (node.id === "f-submit" && !state.engine) return; // keeps "Loading…" until ready
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.placeholder = t(node.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
      node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
    });
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = t("meta.description");
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = PUBLIC_ROOT + FOLDER[state.lang];
    showChosenPlace();
  }

  // Keeps the address bar in step with the language without reloading the
  // page, so a reading already on screen is not lost.
  function showAddress() {
    if (!location.protocol.startsWith("http")) return;
    const target = new URL(FOLDER[state.lang], SITE_ROOT);
    if (target.pathname !== location.pathname) {
      try { history.replaceState(null, "", target.pathname + location.hash); } catch (e) { /* stays as it is */ }
    }
    // Links to the tradition pages follow the language too.
    document.querySelectorAll("a[data-page]").forEach((a) => { a.href = pageUrl(a.dataset.page); });
  }

  const pageUrl = (page) => new URL(FOLDER[state.lang] + page, SITE_ROOT).href;

  async function setLanguage(lang) {
    state.lang = lang;
    try { state.dict = lang === "en" ? state.fallback : await loadDict(lang); } catch (e) { state.dict = state.fallback; }
    try { localStorage.setItem("ft.lang", lang); } catch (e) { /* private mode */ }
    $("lang").value = lang;
    applyStatic();
    showAddress();
    if (state.record) drawRecord(state.record);
  }

  // ------------------------------------------------------------ small helpers
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const value = attrs[key];
        if (value === null || value === undefined || value === false) continue;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else node.setAttribute(key, value === true ? "" : value);
      }
    }
    for (const child of [].concat(children || [])) {
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  function formatDate(iso) {
    const p = iso.slice(0, 10).split("-").map(Number);
    const date = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return new Intl.DateTimeFormat(LOCALE[state.lang], { dateStyle: "long", timeZone: "UTC" }).format(date);
  }

  function formatClock(iso) {
    // "1990-08-15T14:42:46" -> "15 August 1990, 14:42"
    return iso.length > 10 ? formatDate(iso) + ", " + iso.slice(11, 16) : formatDate(iso);
  }

  function formatOffset(seconds) {
    const sign = seconds < 0 ? "−" : "+";
    const abs = Math.abs(seconds);
    const h = Math.floor(abs / 3600);
    const m = Math.round((abs % 3600) / 60);
    return sign + h + (m ? ":" + String(m).padStart(2, "0") : "");
  }

  const elementName = (code) => t("element." + code);
  const animalName = (english) => t("animal." + english.toLowerCase());
  const godName = (code) => t("tengod." + code);

  function fact(label, value, sub) {
    return el("div", { class: "fact" }, [el("small", { text: label }), el("b", { text: value }), sub ? el("span", { text: sub }) : null]);
  }

  function panel(titleKey, introKey, children, id) {
    const page = id && id.indexOf("res-") === 0 ? id.slice(4) + "/" : null;
    return el("section", { class: "panel", id: id || null }, [
      el("header", null, [
        el("h3", { text: t(titleKey) }),
        el("p", { text: t(introKey) }),
        page ? el("a", { class: "panel-more", href: pageUrl(page), "data-page": page, text: t("trad.page") }) : null,
      ]),
    ].concat(children));
  }

  // One traditional statement, with its label, review mark and source.
  function statementCard(s) {
    let text = t("rule." + s.rule, s.params || {});
    const textNode = el("p", { class: "text" });
    if (s.tradition === "numerology" && s.params && s.params.position) {
      textNode.appendChild(el("b", { text: t("numerology.position." + s.params.position, { number: s.params.number }) + ". " }));
    }
    textNode.appendChild(document.createTextNode(text));
    const source = el("p", { class: "source" }, [
      t("label.source") + ": " + t("source.kind." + s.source.kind) + " · " + s.source.work + " · " + s.source.passage,
    ]);
    if (s.source.quote) {
      source.appendChild(document.createTextNode(" "));
      source.appendChild(el("q", { text: s.source.quote }));
    }
    return el("article", { class: "statement" }, [
      textNode,
      el("div", { class: "tags" }, [
        el("span", { class: "tag tradition", title: t("label.tradition.hint"), text: t("label.tradition") }),
        el("span", { class: "tag theme", text: t("theme." + s.theme) }),
        el("span", { class: "tag review", title: t("label.review.hint"), text: t("label.review") }),
      ]),
      source,
    ]);
  }

  function statementsFor(record, tradition, filter) {
    const list = record.statements.filter((s) => s.tradition === tradition && (!filter || filter(s)));
    return list.length ? el("div", { class: "statements" }, list.map(statementCard)) : null;
  }

  // ------------------------------------------------------------ the record
  function drawWhen(r) {
    const facts = [];
    const place = r.input.place ? " · " + r.input.place : "";
    facts.push(fact(t("result.clock"), r.time_known ? formatClock(r.input.date + "T" + r.input.time) : formatDate(r.input.date), (r.time ? t("result.offset", { offset: formatOffset(r.time.utc_offset_seconds) }) : "") + place));
    if (r.time) {
      facts.push(fact(t("result.utc"), formatClock(r.time.utc)));
      if (r.time.true_solar_time) {
        const minutes = Math.round(r.time.true_solar_minus_clock_seconds / 60);
        facts.push(fact(t("result.tst"), formatClock(r.time.true_solar_time), t("result.tst.shift", { minutes: (minutes > 0 ? "+" : "") + minutes })));
      }
    }
    facts.push(fact(t("result.lunar"), t("result.lunar.value", {
      year: r.lunar.year_stem_branch + " " + r.lunar.year,
      leap: r.lunar.is_leap ? t("result.lunar.leap") : "",
      month: r.lunar.month,
      day: r.lunar.day,
    })));
    const children = [el("div", { class: "facts" }, facts)];
    if (r.notes.length) {
      children.push(el("h4", { text: t("result.notes") }));
      children.push(el("ul", { class: "notes" }, r.notes.map((n) => el("li", { text: t("note." + n.code, n.params || {}) }))));
    }
    children.push(el("p", { class: "plain", style: "margin-top:18px", text: t("result.separate") }));
    return el("section", { class: "panel" }, [el("header", null, [el("h3", { text: t("result.when") })])].concat(children));
  }

  function pillarBox(which, p, isDay) {
    if (!p) {
      return el("div", { class: "pillar unknown" }, [el("span", { class: "which", text: t("bazi.pillar." + which) }), el("span", { text: t("bazi.pillar.unknown") })]);
    }
    const hidden = el("div", { class: "hidden-list expert-only" }, [el("span", { text: t("bazi.hidden") })].concat(
      p.hidden.map((h) => el("span", null, [el("b", { class: "el-" + h.element, text: h.stem_zh }), " " + godName(h.ten_god)]))
    ));
    return el("div", { class: "pillar" + (isDay ? " day" : "") }, [
      el("span", { class: "which", text: t("bazi.pillar." + which) }),
      el("span", { class: "role", text: isDay ? t("bazi.daymaster") : godName(p.ten_god) }),
      el("span", { class: "han el-" + p.stem_element, title: t("bazi.stem"), text: p.stem_zh }),
      el("span", { class: "sub", text: t("polarity." + (p.stem_yang ? "yang" : "yin")) + " " + elementName(p.stem_element) }),
      el("span", { class: "han el-" + p.branch_element, title: t("bazi.branch"), text: p.branch_zh }),
      el("span", { class: "sub", text: animalName(p.animal) + " · " + elementName(p.branch_element) }),
      hidden,
    ]);
  }

  function elementBar(counts) {
    const total = ELEMENTS.reduce((sum, e) => sum + counts[e], 0) || 1;
    const bar = el("div", { class: "elbar", role: "img", "aria-label": ELEMENTS.map((e) => elementName(e) + " " + counts[e]).join(", ") },
      ELEMENTS.filter((e) => counts[e] > 0).map((e) => el("span", { class: "bg-" + e, style: "width:" + (100 * counts[e] / total) + "%" })));
    const legend = el("div", { class: "ellegend" }, ELEMENTS.map((e) => el("span", { class: "el-" + e }, [el("i", { class: "bg-" + e }), elementName(e) + " " + counts[e]])));
    return [bar, legend];
  }

  function drawBazi(r) {
    const b = r.bazi;
    const out = [];
    out.push(el("div", { class: "pillars" }, [
      pillarBox("year", b.year, false), pillarBox("month", b.month, false), pillarBox("day", b.day, true), pillarBox("hour", b.hour, false),
    ]));
    out.push(el("h4", { text: t("bazi.daymaster") + " — " + t("bazi.daymaster.value", {
      stem: b.day_master.stem_zh, polarity: t("polarity." + (b.day_master.yang ? "yang" : "yin")), element: elementName(b.day_master.element),
    }) }));
    out.push(statementsFor(r, "bazi", (s) => s.rule.indexOf("bazi.day_master.") === 0));

    out.push(el("h4", { text: t("bazi.elements") }));
    out.push(el("p", { class: "plain", style: "margin-bottom:12px", text: t("bazi.elements.body") }));
    elementBar(b.elements_visible).forEach((n) => out.push(n));
    const absent = ELEMENTS.filter((e) => b.elements_visible[e] === 0).map(elementName);
    if (absent.length) out.push(el("p", { class: "plain", style: "margin-top:10px", text: t("bazi.elements.absent", { list: absent.join(", ") }) }));
    const withHidden = el("div", { class: "expert-only", style: "margin-top:16px" }, [el("p", { class: "plain", style: "margin-bottom:10px", text: t("bazi.elements.hidden") })].concat(elementBar(b.elements_with_hidden)));
    out.push(withHidden);

    const gods = statementsFor(r, "bazi", (s) => s.rule.indexOf("bazi.ten_god.") === 0);
    if (gods) {
      out.push(el("h4", { text: t("bazi.tengods.title") }));
      out.push(el("p", { class: "plain", style: "margin-bottom:12px", text: t("bazi.tengods.body") }));
      out.push(gods);
    }

    out.push(el("h4", { text: t("bazi.luck.title") }));
    if (b.luck) {
      const luck = b.luck;
      out.push(el("p", { class: "plain", text: t(luck.forward ? "bazi.luck.forward" : "bazi.luck.backward") + " " + t("bazi.luck.start", {
        age: luck.start_age_years.toFixed(1), term: luck.counted_to.name_zh,
      }) + (luck.approximate ? " " + t("bazi.luck.approx") : "") }));
      const rows = luck.pillars.map((p) => el("tr", null, [
        el("td", { class: "han-cell", text: p.name_zh }),
        el("td", { class: "num", text: p.start_age.toFixed(1) }),
        el("td", { class: "num", text: String(p.start_year) }),
        el("td", { class: "expert-only", text: godName(p.ten_god) }),
      ]));
      out.push(el("div", { class: "tbl-wrap", style: "margin-top:12px" }, [el("table", { class: "tbl" }, [
        el("thead", null, [el("tr", null, [
          el("th", { text: t("bazi.luck.col.cycle") }), el("th", { text: t("bazi.luck.col.age") }), el("th", { text: t("bazi.luck.col.year") }),
          el("th", { class: "expert-only", text: t("bazi.tengod") }),
        ])]),
        el("tbody", null, rows),
      ])]));
    } else {
      out.push(el("p", { class: "plain", text: t("bazi.luck.none") }));
    }
    if (r.flow_year) {
      out.push(el("p", { class: "plain", style: "margin-top:16px", text: t("bazi.flow", { year: r.flow_year.year, name: r.flow_year.name_zh, god: godName(r.flow_year.ten_god) }) }));
    }
    out.push(el("div", { class: "expert-only", style: "margin-top:16px" }, [
      el("p", { class: "plain", text: t("bazi.year_rule", { year: b.bazi_year }) }),
      el("p", { class: "plain", text: t("bazi.month_rule", {
        opens: b.month_opened_by.name_zh, opens_time: formatClock(b.month_opened_by.beijing),
        closes: b.month_closes_at.name_zh, closes_time: formatClock(b.month_closes_at.beijing),
      }) }),
    ]));
    return panel("bazi.title", "bazi.intro", out, "res-bazi");
  }

  function zodiacLine(z) {
    return t("zodiac.value", { element: elementName(z.element), animal: animalName(z.animal) });
  }

  function drawZodiac(r) {
    const z = r.zodiac;
    const main = z.by_lunar_new_year;
    const out = [el("div", { class: "big" }, [el("b", { text: zodiacLine(main) }), el("span", { text: t("zodiac.year", { name: main.stem_branch, year: main.year }) })])];
    if (z.conventions_differ) {
      out.push(el("div", { class: "rows", style: "margin-top:16px" }, [
        el("div", { class: "row" }, [el("span", { text: t("zodiac.by_new_year") }), el("b", { text: zodiacLine(main) + " · " + main.stem_branch })]),
        el("div", { class: "row" }, [el("span", { text: t("zodiac.by_spring") }), el("b", { text: zodiacLine(z.by_start_of_spring) + " · " + z.by_start_of_spring.stem_branch })]),
      ]));
    }
    out.push(el("div", { style: "margin-top:18px" }, [statementsFor(r, "zodiac")]));
    return panel("zodiac.title", "zodiac.intro", out, "res-zodiac");
  }

  function drawNumerology(r) {
    const n = r.numerology;
    const out = [el("div", { class: "big" }, [
      el("b", { text: String(n.life_path) }),
      el("span", { text: t("numerology.life_path") + " · " + t("numerology.life_path.how", { month: n.life_path_month, day: n.life_path_day, year: n.life_path_year, total: n.life_path }) }),
    ])];
    if (n.methods_differ) out.push(el("p", { class: "plain", style: "margin-top:10px", text: t("numerology.other_method", { number: n.life_path_other_method }) }));
    out.push(el("div", { style: "margin-top:18px" }, [statementsFor(r, "numerology", (s) => s.params.position === "life_path")]));
    const rows = [el("div", { class: "row" }, [el("span", { text: t("numerology.birthday") }), el("b", { text: String(n.birthday) })])];
    if (n.personal_year) rows.push(el("div", { class: "row" }, [el("span", { text: t("numerology.personal_year", { year: n.personal_year.year }) }), el("b", { text: String(n.personal_year.number) })]));
    if (n.name) {
      rows.push(el("div", { class: "row" }, [el("span", { text: t("numerology.expression") }), el("b", { text: String(n.name.expression) })]));
      rows.push(el("div", { class: "row" }, [el("span", { text: t("numerology.soul_urge") }), el("b", { text: String(n.name.soul_urge) })]));
      rows.push(el("div", { class: "row" }, [el("span", { text: t("numerology.personality") }), el("b", { text: String(n.name.personality) })]));
    }
    out.push(el("div", { class: "rows", style: "margin-top:18px" }, rows));
    if (n.name) {
      out.push(el("p", { class: "plain expert-only", style: "margin-top:10px", text: t("numerology.counted_as", { name: n.name.counted_as }) }));
      out.push(el("div", { style: "margin-top:18px" }, [statementsFor(r, "numerology", (s) => s.params.position === "expression")]));
    } else if (n.name_skipped) {
      out.push(el("p", { class: "plain", style: "margin-top:12px", text: t("numerology.name." + n.name_skipped) }));
    }
    return panel("numerology.title", "numerology.intro", out, "res-numerology");
  }

  function drawWeton(r) {
    const w = r.weton;
    const c = w.civil;
    const out = [el("div", { class: "big" }, [
      el("b", { text: t("weton.value", { day: c.day_id, pasaran: c.pasaran }) }),
      el("span", { text: t("weton.neptu") + " · " + t("weton.neptu.how", { day: c.day_id, day_neptu: c.day_neptu, pasaran: c.pasaran, pasaran_neptu: c.pasaran_neptu, total: c.neptu }) }),
    ])];
    if (w.after_sunset) out.push(el("p", { class: "plain", style: "margin-top:12px", text: t("weton.sunset", { name: w.after_sunset.name, neptu: w.after_sunset.neptu }) }));
    out.push(el("div", { style: "margin-top:18px" }, [statementsFor(r, "weton")]));
    if (w.next_dates.length) {
      out.push(el("h4", { text: t("weton.next") }));
      out.push(el("div", { class: "dates" }, w.next_dates.map((d) => el("span", { text: formatDate(d) }))));
    }
    return panel("weton.title", "weton.intro", out, "res-weton");
  }

  // The four calculators a visitor can open from the cards at the top.
  const TRADS = ["bazi", "numerology", "zodiac", "weton"];

  function jumpBar() {
    return el("nav", { class: "jump", "aria-label": t("result.jump") }, [el("span", { text: t("result.jump") })].concat(
      TRADS.map((k) => {
        const b = el("button", { type: "button", class: k === state.focus ? "on" : null, text: t("trad." + k + ".name") });
        b.addEventListener("click", () => showResult(k));
        return b;
      })
    ));
  }

  function drawRecord(r) {
    const host = $("record");
    host.textContent = "";
    [jumpBar(), drawWhen(r), drawBazi(r), drawZodiac(r), drawNumerology(r), drawWeton(r)].forEach((node) => host.appendChild(node));
    markCards();
  }

  // Scrolls to one tradition's result and lights it up for a moment.
  function showResult(key) {
    state.focus = key;
    const target = $("res-" + key);
    if (!target) return;
    document.querySelectorAll("#record .jump button").forEach((b, i) => b.classList.toggle("on", TRADS[i] === key));
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.remove("flash");
    void target.offsetWidth; // restarts the glow if the same card is chosen twice
    target.classList.add("flash");
  }

  // The birth details travel to the tradition pages (bazi/, zodiac/ …) in this
  // browser tab only, in the same shape ft-lesson.js reads. Nothing is sent anywhere.
  const BIRTH_KEY = "ft.birth";

  function rememberBirth(request) {
    const b = {
      date: request.date, time: request.time || "", notime: !request.time, place: state.place, zone: state.zone,
      sex: request.sex || "", name: request.name || "", basis: request.time_basis, daystart: request.day_starts_at,
    };
    try { sessionStorage.setItem(BIRTH_KEY, JSON.stringify(b)); } catch (e) { /* private mode */ }
    try { if (JSON.parse(localStorage.getItem("ft.birth.keep") || "false")) localStorage.setItem(BIRTH_KEY, JSON.stringify(b)); } catch (e) { /* */ }
  }

  function recallBirth() {
    let raw = null;
    try { raw = sessionStorage.getItem(BIRTH_KEY); } catch (e) { /* */ }
    try { if (!raw && JSON.parse(localStorage.getItem("ft.birth.keep") || "false")) raw = localStorage.getItem(BIRTH_KEY); } catch (e) { /* */ }
    let b = null;
    try { b = raw ? JSON.parse(raw) : null; } catch (e) { b = null; }
    if (!b || !b.date) return;
    $("f-date").value = b.date;
    if (b.time) $("f-time").value = b.time;
    $("f-notime").checked = !!b.notime && !b.time;
    $("f-time").disabled = $("f-notime").checked;
    if (b.name) $("f-name").value = b.name;
    if (b.sex) { const r = document.querySelector('input[name="sex"][value="' + b.sex + '"]'); if (r) r.checked = true; }
    if (b.place) choosePlace(b.place);
    if (b.zone && b.place && b.place.alt_tz && b.zone === b.place.alt_tz) {
      state.zone = b.zone;
      const alt = document.querySelector('input[name="clockzone"][value="' + b.zone + '"]');
      if (alt) alt.checked = true;
      showChosenPlace();
    }
  }

  // Once there is a reading, the cards say so and lead to the reading on the tradition page.
  function markCards() {
    document.querySelectorAll("a.trad.open").forEach((card) => {
      const go = card.querySelector(".go");
      go.dataset.i18n = state.record ? "trad.go.done" : "trad.go";
      go.textContent = t(go.dataset.i18n);
    });
  }

  // ------------------------------------------------------------ the form
  function showChosenPlace() {
    const p = state.place;
    $("f-chosen").textContent = p ? t("form.place.chosen", { lat: p.lat, lon: p.lon, tz: state.zone || p.tz }) : "";
  }

  function placeLabel(p) {
    return p.name + (p.han_names.length ? " " + p.han_names[0] : "") + ", " + p.country;
  }

  function closePlaces() {
    $("f-places").hidden = true;
    $("f-place").setAttribute("aria-expanded", "false");
  }

  function choosePlace(p) {
    state.place = p;
    state.zone = p.tz;
    $("f-place").value = placeLabel(p);
    closePlaces();
    const field = $("f-clock-field");
    const box = $("f-clock");
    box.textContent = "";
    if (p.alt_tz) {
      [p.tz, p.alt_tz].forEach((zone, i) => {
        const input = el("input", { type: "radio", name: "clockzone", value: zone, checked: i === 0 });
        input.addEventListener("change", () => { state.zone = zone; showChosenPlace(); });
        box.appendChild(el("label", { class: "radio" }, [input, el("span", { text: zone })]));
      });
      field.hidden = false;
    } else {
      field.hidden = true;
    }
    showChosenPlace();
  }

  function searchPlaces() {
    const list = $("f-places");
    const q = $("f-place").value.trim();
    state.place = null;
    state.zone = null;
    $("f-clock-field").hidden = true;
    showChosenPlace();
    list.textContent = "";
    if (!state.engine || q.length < 2) { closePlaces(); return; }
    let hits = [];
    try { hits = state.engine.places(q, 8); } catch (e) { hits = []; }
    if (!hits.length) {
      list.appendChild(el("li", { "aria-disabled": "true", text: t("form.place.none") }));
    } else {
      hits.forEach((p, i) => {
        const item = el("li", { role: "option", id: "f-place-" + i, "aria-selected": "false" }, [el("span", { text: placeLabel(p) }), el("small", { text: p.tz })]);
        item.addEventListener("mousedown", (ev) => { ev.preventDefault(); choosePlace(p); });
        item.ftPlace = p;
        list.appendChild(item);
      });
    }
    list.hidden = false;
    $("f-place").setAttribute("aria-expanded", "true");
  }

  function placeKeys(ev) {
    const list = $("f-places");
    if (list.hidden) return;
    const items = Array.from(list.querySelectorAll('li[role="option"]'));
    if (!items.length) return;
    let index = items.findIndex((li) => li.getAttribute("aria-selected") === "true");
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      index = ev.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items.forEach((li, i) => li.setAttribute("aria-selected", i === index ? "true" : "false"));
      items[index].scrollIntoView({ block: "nearest" });
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      choosePlace(items[index < 0 ? 0 : index].ftPlace);
    } else if (ev.key === "Escape") {
      closePlaces();
    }
  }

  function todayIso() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function submit(ev) {
    ev.preventDefault();
    const error = $("f-error");
    error.textContent = "";
    const date = $("f-date").value;
    if (!date) { error.textContent = t("form.error.date"); $("f-date").focus(); return; }
    const year = Number(date.slice(0, 4));
    if (year < 1900 || year > 2100) { error.textContent = t("form.error.range"); $("f-date").focus(); return; }
    if (!state.place) { error.textContent = t("form.error.place"); $("f-place").focus(); return; }
    const noTime = $("f-notime").checked || !$("f-time").value;
    const pick = (name) => (document.querySelector('input[name="' + name + '"]:checked') || {}).value || "";
    const request = {
      date: date,
      tz: state.zone || state.place.tz,
      lon: state.place.lon,
      lat: state.place.lat,
      place: placeLabel(state.place),
      time_basis: pick("basis") || "true_solar",
      day_starts_at: pick("daystart") || "23",
      today: todayIso(),
    };
    if (!noTime) request.time = $("f-time").value;
    if (pick("sex")) request.sex = pick("sex");
    if ($("f-name").value.trim()) request.name = $("f-name").value.trim();
    try {
      state.record = state.engine.reading(request);
    } catch (e) {
      error.textContent = String(e.message || e);
      return;
    }
    rememberBirth(request);
    drawRecord(state.record);
    $("results").hidden = false;
    if (state.focus) showResult(state.focus);
    else $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setView(expert) {
    state.expert = expert;
    document.body.classList.toggle("expert", expert);
    $("view-plain").setAttribute("aria-pressed", expert ? "false" : "true");
    $("view-expert").setAttribute("aria-pressed", expert ? "true" : "false");
  }

  // ------------------------------------------------------------ start
  async function start() {
    // Links to other files are pinned to their full address now, because the
    // address bar may move to another language folder later (see showAddress).
    document.querySelectorAll("a[href]").forEach((a) => {
      if (!a.getAttribute("href").startsWith("#")) a.href = a.href;
    });
    state.fallback = await loadDict("en");
    await setLanguage(pickLanguage());
    $("lang").addEventListener("change", (ev) => setLanguage(ev.target.value));
    $("f-notime").addEventListener("change", (ev) => { $("f-time").disabled = ev.target.checked; });
    let timer = null;
    $("f-place").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(searchPlaces, 140); });
    $("f-place").addEventListener("keydown", placeKeys);
    $("f-place").addEventListener("blur", () => setTimeout(closePlaces, 120));
    $("birth").addEventListener("submit", submit);
    $("view-plain").addEventListener("click", () => setView(false));
    $("view-expert").addEventListener("click", () => setView(true));
    try {
      state.engine = await FTEngine.load(new URL("assets/wasm/ft.wasm", SITE_ROOT));
      const button = $("f-submit");
      button.disabled = false;
      button.textContent = t("form.submit");
      button.dataset.i18n = "form.submit";
      recallBirth();
    } catch (e) {
      $("f-error").textContent = t("form.error.engine");
    }
    // For automated checks and curious visitors.
    window.FT = { state: state, t: t };
  }

  start();
})();
