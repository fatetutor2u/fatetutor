/*!
 * Fate Tutor — Parallel Life, "Build my world" (parallel-life/).
 *
 * The visitor's facts, roles and what-if branches are sent to the Rust engine
 * ({"cmd":"parallel_world"}), which returns the labelled world map, every branch's
 * simulated range, the side-by-side comparison and the tradition notes. This file
 * only collects input and draws. Nothing leaves the device; saving is the visitor's
 * choice (this browser, or a file they download).
 * All text goes in with textContent.
 */
(function (w, d) {
  "use strict";

  const LANGS = ["en", "zh-hans", "zh-hant", "id", "ms"];
  const LOCALE = { en: "en-GB", "zh-hans": "zh-CN", "zh-hant": "zh-TW", id: "id-ID", ms: "ms-MY" };
  const HTML_LANG = { en: "en", "zh-hans": "zh-Hans", "zh-hant": "zh-Hant", id: "id", ms: "ms" };
  const FOLDER = { en: "", "zh-hans": "zh-hans/", "zh-hant": "zh-hant/", id: "id/", ms: "ms/" };
  const SITE_ROOT = new URL("../../", d.currentScript.src);
  const PAGE = "parallel-life/";
  const SVG = "http://www.w3.org/2000/svg";
  const SAVE_KEY = "ft.parallel.world";
  const LABEL_COLOR = { user_fact: "#f2ca50", evidence: "#93d7ff", assumption: "#c084fc", tradition: "#44e2cd", simulated: "#ff8a6b" };
  const BRANCH_COLOR = ["#f2ca50", "#44e2cd", "#93d7ff", "#ff8a6b", "#c084fc", "#5fd4a0", "#f472b6", "#e9c349", "#7bd0ff", "#cbd5e1", "#fca5a5", "#a3e635"];
  const ROLE_KINDS = ["employer", "customer_group", "business_partner", "household_member", "industry", "local_market", "policy_maker"];
  const ITEM_KINDS = ["news", "policy", "report", "indicator", "fiction"];
  const SHOCK_KINDS = ["income_pause", "unexpected_cost", "opportunity"];

  const $ = (id) => d.getElementById(id);
  const st = { lang: "en", dict: {}, fallback: {}, engine: null, answer: null, hidden: {}, lens: null, nextId: 1, timer: null };
  let model = null;

  // ------------------------------------------------------------ helpers
  function t(key, p) {
    let s = st.dict[key];
    if (s === undefined) s = st.fallback[key];
    if (s === undefined) return key;
    if (p) s = s.replace(/\{(\w+)\}/g, (m, n) => (p[n] !== undefined ? String(p[n]) : m));
    return s;
  }
  function el(tag, attrs, kids) {
    const n = d.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === "text") n.textContent = v; else if (k === "class") n.className = v; else n.setAttribute(k, v === true ? "" : v);
    }
    [].concat(kids || []).forEach((c) => c !== null && c !== undefined && n.append(c));
    return n;
  }
  function sv(tag, attrs, kids) {
    const n = d.createElementNS(SVG, tag);
    for (const k in attrs || {}) { if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    [].concat(kids || []).forEach((c) => c && n.appendChild(c));
    return n;
  }
  const money = (v) => new Intl.NumberFormat(LOCALE[st.lang], { maximumFractionDigits: 0 }).format(v);
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + money(Math.abs(v));
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const num = (id, fallback) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : fallback; };
  const today = () => { const n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0"); };

  // ------------------------------------------------------------ languages
  function pickLanguage() {
    const q = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(q)) return q;
    const folder = d.documentElement.dataset.lang;
    if (LANGS.includes(folder) && folder !== "en") return folder;
    let saved = null;
    try { saved = w.localStorage.getItem("ft.lang"); } catch (e) { /* */ }
    if (LANGS.includes(saved)) return saved;
    const nav = (navigator.language || "en").toLowerCase();
    if (nav.startsWith("zh")) return /tw|hk|mo|hant/.test(nav) ? "zh-hant" : "zh-hans";
    if (nav.startsWith("id")) return "id";
    if (nav.startsWith("ms")) return "ms";
    return "en";
  }
  async function loadDict(lang) {
    const r = await fetch(new URL("assets/i18n/" + lang + ".json", SITE_ROOT), { cache: "no-cache" });
    if (!r.ok) throw new Error("no wording");
    return r.json();
  }
  function applyStatic() {
    d.documentElement.lang = HTML_LANG[st.lang];
    d.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
    d.querySelectorAll("[data-i18n-placeholder]").forEach((n) => { n.placeholder = t(n.dataset.i18nPlaceholder); });
    d.querySelectorAll("[data-i18n-aria-label]").forEach((n) => n.setAttribute("aria-label", t(n.dataset.i18nAriaLabel)));
    d.querySelectorAll("[data-i18n-content]").forEach((n) => n.setAttribute("content", t(n.dataset.i18nContent)));
    if (location.protocol.startsWith("http")) {
      const target = new URL(FOLDER[st.lang] + PAGE, SITE_ROOT);
      if (target.pathname !== location.pathname) { try { history.replaceState(null, "", target.pathname + location.hash); } catch (e) { /* */ } }
      d.querySelectorAll("a[data-page]").forEach((a) => { a.href = new URL(FOLDER[st.lang] + a.dataset.page, SITE_ROOT).href; });
    }
  }
  async function setLanguage(lang) {
    st.lang = lang;
    try { st.dict = lang === "en" ? st.fallback : await loadDict(lang); } catch (e) { st.dict = st.fallback; }
    try { w.localStorage.setItem("ft.lang", lang); } catch (e) { /* */ }
    $("lang").value = lang;
    applyStatic();
    drawLegend(); fillRoleKinds(); drawRoles(); drawBranches(); drawLens(); draw();
  }

  // ------------------------------------------------------------ the model
  function blankBranch(id, parent) {
    return { id: id, parent_id: parent, name: "", decision: "", income_change_pct: 2, cost_change_pct: 3, start_income: null, start_cost: null, one_off_cost: 0, shocks: [], evidence: [] };
  }
  function newModel() {
    const m = { roles: [], branches: [blankBranch("now", null)], years: 10, seed: 1 };
    m.branches[0].name = t("pg.pl.branch.start");
    return m;
  }
  function readFacts() {
    return {
      age: Math.round(num("f-age", 30)), dependents: Math.round(num("f-dependents", 0)),
      place: $("f-place").value.trim(), work: $("f-work").value.trim(), industry: $("f-industry").value.trim(),
      cash: num("f-cash", 0), yearly_income: num("f-income", 0), yearly_cost: num("f-cost", 0),
      goals: $("f-goals").value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 5),
      roles: model.roles,
    };
  }
  function writeFacts(f) {
    if (!f) return;
    $("f-age").value = f.age; $("f-dependents").value = f.dependents || 0; $("f-place").value = f.place || ""; $("f-work").value = f.work || "";
    $("f-industry").value = f.industry || ""; $("f-cash").value = f.cash; $("f-income").value = f.yearly_income; $("f-cost").value = f.yearly_cost;
    $("f-goals").value = (f.goals || []).join("\n");
  }
  function nextBranchId() {
    let id;
    do { id = "b" + st.nextId++; } while (model.branches.some((b) => b.id === id));
    return id;
  }

  // ------------------------------------------------------------ engine
  function request() {
    const req = { cmd: "parallel_world", state: readFacts(), years: Math.round(num("f-years", 10)), first_year: new Date().getFullYear() + 1, today: today(), seed: model.seed, branches: model.branches.map(clean) };
    if (st.lens) req.tradition = st.lens;
    return req;
  }
  function clean(b) {
    const out = Object.assign({}, b);
    out.name = out.name || "";
    ["start_income", "start_cost"].forEach((k) => { if (out[k] === null || out[k] === "" || !Number.isFinite(out[k])) delete out[k]; });
    return out;
  }
  function schedule() { clearTimeout(st.timer); st.timer = setTimeout(run, 200); }
  function run() {
    if (!st.engine) return;
    $("pl-error").textContent = "";
    try {
      st.answer = st.engine.call(request());
    } catch (e) {
      $("pl-error").textContent = t("pg.pl.error", { why: e.message || String(e) });
      return;
    }
    draw();
  }

  // ------------------------------------------------------------ legend, roles, lens
  function drawLegend() {
    const host = $("pl-legend");
    host.textContent = "";
    ["user_fact", "evidence", "assumption", "tradition", "simulated"].forEach((k) =>
      host.append(el("span", { class: "pl-tag", title: t("pg.pl.label." + k + ".what") }, [el("i", { style: "background:" + LABEL_COLOR[k] }), t("pg.pl.label." + k)])));
  }
  function fillRoleKinds() {
    const s = $("role-kind");
    const v = s.value;
    s.textContent = "";
    ROLE_KINDS.forEach((k) => s.append(el("option", { value: k, text: t("pg.pl.role." + k) })));
    if (v) s.value = v;
  }
  function drawRoles() {
    const host = $("pl-roles");
    host.textContent = "";
    if (!model.roles.length) host.append(el("p", { class: "soft small", text: t("pg.pl.roles.none") }));
    model.roles.forEach((r, i) => {
      const x = el("button", { type: "button", class: "linkbtn", text: t("pg.pl.remove") });
      x.addEventListener("click", () => { model.roles.splice(i, 1); drawRoles(); schedule(); });
      host.append(el("div", { class: "pl-role" }, [el("i", { style: "background:" + LABEL_COLOR.assumption }), el("b", { text: t("pg.pl.role." + r.kind) }), " — " + (r.objective || t("pg.pl.roles.noobjective")) + " ", x]));
    });
  }
  function drawLens() {
    const host = $("pl-lens");
    host.textContent = "";
    if (st.lens) {
      host.append(el("p", null, [el("i", { class: "dot", style: "background:" + LABEL_COLOR.tradition }), t("pg.pl.lens.on", { dm: st.lens.day_master, n: st.lens.luck.length })]));
    } else {
      const a = el("a", { href: new URL(FOLDER[st.lang] + "bazi/", SITE_ROOT).href, text: t("pg.pl.lens.link") });
      host.append(el("p", { class: "soft small" }, [t("pg.pl.lens.off") + " ", a]));
    }
  }

  // ------------------------------------------------------------ branch editor
  function field(labelKey, input) { return el("label", null, [el("span", { text: t(labelKey) }), input]); }
  function numInput(value, onset, attrs) {
    const i = el("input", Object.assign({ class: "input", type: "number", value: value === null || value === undefined ? "" : value }, attrs || {}));
    i.addEventListener("input", () => { const v = parseFloat(i.value); onset(i.value === "" ? null : (Number.isFinite(v) ? v : null)); schedule(); });
    return i;
  }
  function textInput(value, onset, attrs) {
    const i = el("input", Object.assign({ class: "input", type: "text", value: value || "", maxlength: "200" }, attrs || {}));
    i.addEventListener("input", () => { onset(i.value); schedule(); });
    return i;
  }
  function selectInput(options, value, onset, prefix) {
    const s = el("select", { class: "input" }, options.map((o) => el("option", { value: o, text: t(prefix + o) })));
    s.value = value;
    s.addEventListener("change", () => { onset(s.value); drawBranches(); schedule(); });
    return s;
  }

  function drawBranches() {
    const host = $("pl-branches");
    host.textContent = "";
    model.branches.forEach((b, idx) => {
      const color = BRANCH_COLOR[idx % BRANCH_COLOR.length];
      const card = el("article", { class: "pl-branch", style: "border-left-color:" + color });
      const parent = b.parent_id ? model.branches.find((x) => x.id === b.parent_id) : null;
      card.append(el("header", null, [
        el("span", { class: "pl-dot", style: "background:" + color }),
        el("b", { text: b.name || (idx === 0 ? t("pg.pl.branch.start") : t("pg.pl.branch.unnamed")) }),
        el("small", { text: parent ? t("pg.pl.branch.from", { name: parent.name || parent.id }) : t("pg.pl.branch.root") }),
      ]));
      const grid = el("div", { class: "pl-fields" }, [
        field("pg.pl.b.name", textInput(b.name, (v) => { b.name = v; card.querySelector("header b").textContent = v || t("pg.pl.branch.unnamed"); })),
        idx === 0 ? null : field("pg.pl.b.decision", textInput(b.decision, (v) => { b.decision = v; })),
        field("pg.pl.b.income_change", numInput(b.income_change_pct, (v) => { b.income_change_pct = v === null ? 0 : v; }, { step: "0.5", min: "-50", max: "100" })),
        field("pg.pl.b.cost_change", numInput(b.cost_change_pct, (v) => { b.cost_change_pct = v === null ? 0 : v; }, { step: "0.5", min: "-50", max: "100" })),
        idx === 0 ? null : field("pg.pl.b.start_income", numInput(b.start_income, (v) => { b.start_income = v; }, { min: "0", step: "100", placeholder: t("pg.pl.b.unchanged") })),
        idx === 0 ? null : field("pg.pl.b.start_cost", numInput(b.start_cost, (v) => { b.start_cost = v; }, { min: "0", step: "100", placeholder: t("pg.pl.b.unchanged") })),
        idx === 0 ? null : field("pg.pl.b.one_off", numInput(b.one_off_cost, (v) => { b.one_off_cost = v === null ? 0 : v; }, { min: "0", step: "100" })),
      ]);
      card.append(grid);
      card.append(el("p", { class: "pl-tagline" }, [el("i", { style: "background:" + LABEL_COLOR.assumption }), t("pg.pl.b.assumptions_note")]));

      // shocks
      const shocks = el("div", { class: "pl-sub" }, [el("span", { class: "legend-title", text: t("pg.pl.shocks.title") })]);
      b.shocks.forEach((s, i) => {
        const valueKey = s.kind === "income_pause" ? "months" : s.kind === "unexpected_cost" ? "amount" : "income_delta";
        const rm = el("button", { type: "button", class: "linkbtn", text: t("pg.pl.remove") });
        rm.addEventListener("click", () => { b.shocks.splice(i, 1); drawBranches(); schedule(); });
        shocks.append(el("div", { class: "pl-row" }, [
          selectInput(SHOCK_KINDS, s.kind, (v) => { const yr = s.year; b.shocks[i] = { kind: v, year: yr }; b.shocks[i][v === "income_pause" ? "months" : v === "unexpected_cost" ? "amount" : "income_delta"] = v === "income_pause" ? 3 : 0; }, "pg.pl.shock."),
          field("pg.pl.shock.year", numInput(s.year, (v) => { s.year = v === null ? 1 : Math.round(v); }, { min: "1", max: "30" })),
          field("pg.pl.shock." + valueKey, numInput(s[valueKey], (v) => { s[valueKey] = v === null ? 0 : v; }, { step: valueKey === "months" ? "1" : "100" })),
          rm,
        ]));
      });
      const addShock = el("button", { type: "button", class: "ghost", text: t("pg.pl.shocks.add") });
      addShock.addEventListener("click", () => { b.shocks.push({ kind: "income_pause", year: 1, months: 3 }); drawBranches(); schedule(); });
      shocks.append(addShock);
      card.append(shocks);

      // evidence and fiction
      const ev = el("div", { class: "pl-sub" }, [el("span", { class: "legend-title", text: t("pg.pl.items.title") }), el("p", { class: "soft small", text: t("pg.pl.items.hint") })]);
      b.evidence.forEach((e, i) => {
        const rm = el("button", { type: "button", class: "linkbtn", text: t("pg.pl.remove") });
        rm.addEventListener("click", () => { b.evidence.splice(i, 1); drawBranches(); schedule(); });
        const fiction = e.kind === "fiction";
        ev.append(el("div", { class: "pl-item" }, [
          el("i", { class: "pl-dot", style: "background:" + (fiction ? LABEL_COLOR.assumption : LABEL_COLOR.evidence) }),
          selectInput(ITEM_KINDS, e.kind, (v) => { e.kind = v; }, "pg.pl.item."),
          field("pg.pl.item.summary", textInput(e.summary, (v) => { e.summary = v; })),
          fiction ? null : field("pg.pl.item.source", textInput(e.source, (v) => { e.source = v; })),
          fiction ? null : field("pg.pl.item.observed", (() => { const i2 = el("input", { class: "input", type: "date", value: e.observed || "" }); i2.addEventListener("change", () => { e.observed = i2.value; schedule(); }); return i2; })()),
          fiction ? null : field("pg.pl.item.expires", (() => { const i2 = el("input", { class: "input", type: "date", value: e.expires || "" }); i2.addEventListener("change", () => { e.expires = i2.value; schedule(); }); return i2; })()),
          field("pg.pl.item.income_effect", numInput(e.income_effect_pct, (v) => { e.income_effect_pct = v === null ? 0 : v; }, { step: "0.5" })),
          field("pg.pl.item.cost_effect", numInput(e.cost_effect_pct, (v) => { e.cost_effect_pct = v === null ? 0 : v; }, { step: "0.5" })),
          rm,
        ]));
      });
      const addItem = el("button", { type: "button", class: "ghost", text: t("pg.pl.items.add") });
      addItem.addEventListener("click", () => {
        const id = "e" + (b.evidence.length + 1) + "x" + st.nextId++;
        b.evidence.push({ id: id, kind: "news", summary: "", source: "", observed: today(), expires: "", income_effect_pct: 0, cost_effect_pct: 0 });
        drawBranches();
      });
      ev.append(addItem);
      card.append(ev);

      // actions
      const fork = el("button", { type: "button", class: "btn btn-sm", text: t("pg.pl.branch.fork") });
      fork.addEventListener("click", () => {
        const c = JSON.parse(JSON.stringify(b));
        c.id = nextBranchId(); c.parent_id = b.id; c.name = t("pg.pl.branch.copy", { name: b.name || b.id }); c.decision = "";
        c.evidence.forEach((e, k) => { e.id = "e" + k; });
        if (model.branches.length >= 12) { $("pl-error").textContent = t("pg.pl.branch.max"); return; }
        model.branches.push(c); drawBranches(); schedule();
      });
      const acts = el("div", { class: "pl-actions" }, [fork]);
      if (idx > 0) {
        const del = el("button", { type: "button", class: "linkbtn", text: t("pg.pl.branch.delete") });
        del.addEventListener("click", () => {
          const gone = new Set([b.id]);
          let grew = true;
          while (grew) { grew = false; model.branches.forEach((x) => { if (x.parent_id && gone.has(x.parent_id) && !gone.has(x.id)) { gone.add(x.id); grew = true; } }); }
          model.branches = model.branches.filter((x) => !gone.has(x.id));
          drawBranches(); schedule();
        });
        acts.append(del);
      }
      card.append(acts);
      host.append(card);
    });
  }

  function quick(kind) {
    const root = model.branches[0];
    if (model.branches.length >= 12) { $("pl-error").textContent = t("pg.pl.branch.max"); return; }
    const c = JSON.parse(JSON.stringify(root));
    c.id = nextBranchId(); c.parent_id = root.id; c.name = t("pg.pl.quick." + kind); c.decision = t("pg.pl.quick." + kind + ".decision");
    c.evidence = []; c.shocks = [];
    model.branches.push(c);
    drawBranches(); schedule();
    const cards = d.querySelectorAll(".pl-branch");
    cards[cards.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ------------------------------------------------------------ drawing the answer
  function draw() {
    const a = st.answer;
    if (!a) return;
    drawMap(a);
    drawChart(a);
    drawCompare(a);
    drawNotes(a);
  }

  function nodeTitle(n) {
    if (n.kind === "role") return t("pg.pl.role." + n.sub);
    if (n.kind === "evidence") return t("pg.pl.item." + n.sub);
    if (n.kind === "decision") { const b = model.branches.find((x) => x.id === n.sub); return b && b.name ? b.name : t("pg.pl.node.decision"); }
    return t("pg.pl.node." + n.kind);
  }
  function nodeValue(n) {
    if (n.kind === "money") { const [c, i, k] = n.value.split("|").map(Number); return t("pg.pl.node.money.value", { cash: money(c), income: money(i), cost: money(k) }); }
    if (n.kind === "me") return t("pg.pl.node.me.value", { age: n.value });
    if (n.kind === "household") return t("pg.pl.node.household.value", { n: n.value });
    if (n.kind === "tradition") return n.value;
    return n.value || t("pg.pl.node.empty");
  }

  function drawMap(a) {
    const host = $("pl-map");
    host.textContent = "";
    const nodes = a.world.nodes, links = a.world.links;
    const W = 720, H = 520, cx = W / 2, cy = H / 2;
    const parentOf = {};
    links.forEach((l) => { parentOf[l.to] = l.from; });
    const kids = {};
    links.forEach((l) => { (kids[l.from] = kids[l.from] || []).push(l.to); });
    const pos = { me: [cx, cy] };
    const ring1 = kids.me || [];
    ring1.forEach((id, i) => { const ang = -Math.PI / 2 + (2 * Math.PI * i) / ring1.length; pos[id] = [cx + 150 * Math.cos(ang), cy + 150 * Math.sin(ang)]; });
    const place = (id, depth) => {
      const ch = kids[id] || [];
      const [px, py] = pos[id];
      const base = Math.atan2(py - cy, px - cx);
      ch.forEach((c, i) => {
        const spread = Math.min(1.1, 0.42 * ch.length);
        const ang = base + (ch.length === 1 ? 0 : -spread / 2 + (spread * i) / (ch.length - 1));
        const r = 95 - depth * 10;
        pos[c] = [px + r * Math.cos(ang), py + r * Math.sin(ang)];
        place(c, depth + 1);
      });
    };
    ring1.forEach((id) => place(id, 0));
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "pl-map-svg", role: "img", "aria-label": t("pg.pl.map.eyebrow") });
    links.forEach((l) => {
      if (!pos[l.from] || !pos[l.to]) return;
      s.appendChild(sv("line", { x1: pos[l.from][0], y1: pos[l.from][1], x2: pos[l.to][0], y2: pos[l.to][1], class: "pl-link" }));
    });
    nodes.forEach((n) => {
      const p = pos[n.id];
      if (!p) return;
      const x = Math.max(60, Math.min(W - 60, p[0])), y = Math.max(28, Math.min(H - 28, p[1]));
      const g = sv("g", { class: "pl-node", tabindex: "0" });
      g.appendChild(sv("circle", { cx: x, cy: y, r: n.id === "me" ? 34 : 24, fill: LABEL_COLOR[n.label] + "26", stroke: LABEL_COLOR[n.label], "stroke-width": n.id === "me" ? 2.5 : 1.6 }));
      g.appendChild(sv("text", { x: x, y: y - (n.id === "me" ? 2 : 1), "text-anchor": "middle", class: "pl-n-title", text: short(nodeTitle(n), 14) }));
      g.appendChild(sv("text", { x: x, y: y + 13, "text-anchor": "middle", class: "pl-n-value", text: short(nodeValue(n), 18) }));
      const show = () => {
        const box = $("pl-detail");
        box.textContent = "";
        box.append(el("span", { class: "pl-tag" }, [el("i", { style: "background:" + LABEL_COLOR[n.label] }), t("pg.pl.label." + n.label)]));
        box.append(el("h3", { text: nodeTitle(n) }));
        box.append(el("p", { text: nodeValue(n) }));
        box.append(el("p", { class: "soft small", text: t("pg.pl.label." + n.label + ".what") }));
      };
      g.addEventListener("click", show);
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); show(); } });
      s.appendChild(g);
    });
    host.appendChild(s);
    if (!$("pl-detail").textContent) $("pl-detail").append(el("p", { class: "soft small", text: t("pg.pl.map.hint") }));
  }

  function drawChart(a) {
    const host = $("pl-chart");
    host.textContent = "";
    const W = 760, H = 360, L = 78, R = 18, T = 18, B = 40;
    const years = a.branches[0].result.years.length;
    let lo = 0, hi = 0;
    a.branches.forEach((b) => { if (st.hidden[b.id]) return; b.result.years.forEach((y) => { lo = Math.min(lo, y.low); hi = Math.max(hi, y.high); }); });
    if (hi === lo) hi = lo + 1;
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const X = (yr) => L + ((W - L - R) * yr) / years;
    const Y = (v) => T + ((H - T - B) * (hi - v)) / (hi - lo);
    const s = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "pl-chart-svg", role: "img", "aria-label": t("pg.pl.results.title") });
    for (let k = 0; k <= 4; k++) {
      const v = lo + ((hi - lo) * k) / 4;
      s.appendChild(sv("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "pl-grid" }));
      s.appendChild(sv("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end", class: "pl-axis", text: money(v) }));
    }
    s.appendChild(sv("line", { x1: L, x2: W - R, y1: Y(0), y2: Y(0), class: "pl-zero" }));
    for (let yr = 0; yr <= years; yr += Math.max(1, Math.ceil(years / 10))) {
      s.appendChild(sv("text", { x: X(yr), y: H - B + 18, "text-anchor": "middle", class: "pl-axis", text: String(a.branches.length && yr === 0 ? t("pg.pl.chart.now") : new Date().getFullYear() + yr) }));
    }
    (a.tradition_notes || []).forEach((n) => {
      if (n.kind !== "luck_cycle_begins") return;
      s.appendChild(sv("line", { x1: X(n.year - 1), x2: X(n.year - 1), y1: T, y2: H - B, class: "pl-lensline" }));
      s.appendChild(sv("text", { x: X(n.year - 1) + 4, y: T + 12, class: "pl-lenstext", text: n.name_zh }));
    });
    a.branches.forEach((b, i) => {
      if (st.hidden[b.id]) return;
      const c = BRANCH_COLOR[i % BRANCH_COLOR.length];
      const start = readFacts().cash - (b.id === "now" ? 0 : (model.branches[i] || {}).one_off_cost || 0);
      const pts = [{ year: 0, low: start, middle: start, high: start }].concat(b.result.years);
      const band = pts.map((p) => X(p.year) + "," + Y(p.high)).join(" ") + " " + pts.slice().reverse().map((p) => X(p.year) + "," + Y(p.low)).join(" ");
      s.appendChild(sv("polygon", { points: band, fill: c + "22", stroke: "none" }));
      s.appendChild(sv("polyline", { points: pts.map((p) => X(p.year) + "," + Y(p.middle)).join(" "), fill: "none", stroke: c, "stroke-width": 2.4 }));
    });
    host.appendChild(s);
    const key = $("pl-chartkey");
    key.textContent = "";
    a.branches.forEach((b, i) => {
      const btn = el("button", { type: "button", class: "pl-keybtn" + (st.hidden[b.id] ? " off" : "") }, [el("i", { style: "background:" + BRANCH_COLOR[i % BRANCH_COLOR.length] }), b.name || b.id]);
      btn.addEventListener("click", () => { st.hidden[b.id] = !st.hidden[b.id]; drawChart(a); });
      key.append(btn);
    });
    key.append(el("span", { class: "soft small", text: t("pg.pl.chart.key") }));
  }

  function drawCompare(a) {
    const table = $("pl-compare");
    table.textContent = "";
    const head = ["branch", "end_middle", "vs_middle", "vs_low", "spread", "below_zero"].map((k) => el("th", { text: t("pg.pl.cmp." + k) }));
    table.append(el("thead", null, el("tr", null, head)));
    const body = el("tbody");
    a.comparison.forEach((c, i) => {
      const b = a.branches[i];
      body.append(el("tr", null, [
        el("td", null, [el("i", { class: "pl-dot", style: "background:" + BRANCH_COLOR[i % BRANCH_COLOR.length] }), b.name || b.id, b.decision ? el("small", { text: b.decision }) : null]),
        el("td", { class: "num", text: money(c.ending_middle) }),
        el("td", { class: "num", text: i === 0 ? "—" : signed(c.vs_start_middle) }),
        el("td", { class: "num", text: i === 0 ? "—" : signed(c.vs_start_low) }),
        el("td", { class: "num", text: money(c.spread) }),
        el("td", { text: c.middle_below_zero_from ? t("pg.pl.cmp.from_year", { y: new Date().getFullYear() + c.middle_below_zero_from }) : c.low_below_zero_from ? t("pg.pl.cmp.low_only", { y: new Date().getFullYear() + c.low_below_zero_from }) : t("pg.pl.cmp.never") }),
      ]));
    });
    table.append(body);
  }

  function drawNotes(a) {
    const host = $("pl-notes");
    host.textContent = "";
    host.append(el("p", { class: "pl-tagline" }, [el("i", { style: "background:" + LABEL_COLOR.simulated }), t("pg.pl.results.label", { trials: a.branches[0].result.trials })]));
    (a.tradition_notes || []).forEach((n) => {
      host.append(el("p", { class: "pl-tagline" }, [el("i", { style: "background:" + LABEL_COLOR.tradition }), t("pg.pl.lens." + n.kind, { year: n.calendar_year, name: n.name_zh })]));
    });
  }

  // ------------------------------------------------------------ saving
  function snapshot() { return { version: 1, saved_at: new Date().toISOString(), facts: readFacts(), model: model, years: Math.round(num("f-years", 10)) }; }
  function restore(s) {
    if (!s || !s.model || !Array.isArray(s.model.branches) || !s.model.branches.length) throw new Error("not a Fate Tutor world file");
    model = s.model;
    model.roles = Array.isArray(model.roles) ? model.roles : [];
    writeFacts(s.facts);
    $("f-years").value = s.years || 10;
    drawRoles(); drawBranches(); run();
  }
  function wireSaving() {
    $("pl-save").addEventListener("click", () => {
      try { w.localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); $("pl-saved").textContent = t("pg.pl.save.done"); } catch (e) { $("pl-saved").textContent = t("pg.pl.save.failed"); }
    });
    $("pl-download").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" });
      const a = el("a", { href: URL.createObjectURL(blob), download: "my-parallel-world.json" });
      d.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    $("pl-open").addEventListener("change", (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      f.text().then((txt) => { try { restore(JSON.parse(txt)); $("pl-saved").textContent = t("pg.pl.save.opened"); } catch (e) { $("pl-saved").textContent = t("pg.pl.save.badfile"); } });
      ev.target.value = "";
    });
    $("pl-clear").addEventListener("click", () => {
      try { w.localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ }
      model = newModel(); writeFacts({ age: 30, dependents: 0, cash: 10000, yearly_income: 30000, yearly_cost: 22000, goals: [] });
      $("pl-saved").textContent = t("pg.pl.save.cleared");
      drawRoles(); drawBranches(); run();
    });
  }

  // ------------------------------------------------------------ the Destiny lens (BaZi luck cycles), never part of the numbers
  function loadLens() {
    let b = null;
    try { b = JSON.parse(w.sessionStorage.getItem("ft.birth") || w.localStorage.getItem("ft.birth") || "null"); } catch (e) { b = null; }
    if (!b || !b.date) return null;
    if (b.date && !$("f-age").dataset.touched) {
      const now = new Date(), [y, m, dd] = b.date.split("-").map(Number);
      let age = now.getFullYear() - y; if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < dd)) age -= 1;
      if (age >= 0 && age <= 120) $("f-age").value = age;
    }
    if (!b.sex) return null;
    const req = { cmd: "reading", date: b.date, tz: b.zone || (b.place && b.place.tz) || "UTC", sex: b.sex, today: today(), time_basis: b.basis || "true_solar", day_starts_at: b.daystart || "23" };
    if (b.time && !b.notime) req.time = b.time;
    if (b.place) { req.lon = b.place.lon; req.lat = b.place.lat; }
    try {
      const r = st.engine.call(req);
      if (!r.bazi.luck) return null;
      return { tradition: "bazi", day_master: r.bazi.day_master.stem_zh, luck: r.bazi.luck.pillars.map((p) => ({ name_zh: p.name_zh, start_year: p.start_year })) };
    } catch (e) { return null; }
  }

  // ------------------------------------------------------------ start
  async function start() {
    st.fallback = await loadDict("en");
    st.lang = pickLanguage();
    try { st.dict = st.lang === "en" ? st.fallback : await loadDict(st.lang); } catch (e) { st.dict = st.fallback; }
    $("lang").value = st.lang;
    applyStatic();
    $("lang").addEventListener("change", (ev) => setLanguage(ev.target.value));
    model = newModel();
    let saved = null;
    try { saved = JSON.parse(w.localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { saved = null; }
    drawLegend(); fillRoleKinds();
    ["f-age", "f-dependents", "f-place", "f-work", "f-industry", "f-cash", "f-income", "f-cost", "f-goals", "f-years"].forEach((id) =>
      $(id).addEventListener("input", () => { $(id).dataset.touched = "1"; schedule(); }));
    $("role-add").addEventListener("click", () => {
      if (model.roles.length >= 12) return;
      model.roles.push({ kind: $("role-kind").value, objective: $("role-objective").value.trim() });
      $("role-objective").value = "";
      drawRoles(); schedule();
    });
    d.querySelectorAll("[data-quick]").forEach((b) => b.addEventListener("click", () => quick(b.dataset.quick)));
    wireSaving();
    try {
      st.engine = await w.FTEngine.load(new URL("assets/wasm/ft.wasm", SITE_ROOT));
    } catch (e) {
      $("pl-error").textContent = t("form.error.engine");
      return;
    }
    st.lens = loadLens();
    if (saved) { try { restore(saved); $("pl-saved").textContent = t("pg.pl.save.loaded"); } catch (e) { saved = null; } }
    drawRoles(); drawBranches(); drawLens();
    run();
    w.FTPL = { st: st, get model() { return model; }, t: t };
  }

  start();
})(window, document);
