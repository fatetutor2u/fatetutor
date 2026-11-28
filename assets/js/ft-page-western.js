/* Fate Tutor Western astrology page. The Rust engine sets out the chart in this browser; this file
   reads the form, borrows birth details saved by other Fate Tutor pages, and draws the wheel and tables. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const SVG = "http://www.w3.org/2000/svg";
  const SIGNS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
  const GLYPH = Object.fromEntries(Object.entries({ sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂", jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆" }).map(([k, g]) => [k, g + "︎"]));
  // U+FE0E asks for the plain text symbol, not a coloured emoji.
  const SIGN_GLYPH = Array.from("♈♉♊♋♌♍♎♏♐♑♒♓", (g) => g + "︎");
  let engine, words = {}, language = "en";
  const t = (key, fallback, params) => {
    let text = words[key] || fallback || key;
    Object.entries(params || {}).forEach(([name, value]) => { text = text.split("{" + name + "}").join(value); });
    return text;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } };
  const dm = (x) => { let d = Math.floor(x), m = Math.round((x - d) * 60); if (m === 60) { d += 1; m = 0; } return d + "°" + String(m).padStart(2, "0") + "′"; };
  const signName = (i) => t("pg.western.sign." + SIGNS[i]);
  const place = (lon) => { const s = Math.floor(lon / 30) % 12; return SIGN_GLYPH[s] + " " + signName(s) + " " + dm(lon - 30 * s); };
  const bodyName = (k) => t("pg.western.body." + k);

  function savedBirth() {
    let raw = null;
    try { raw = sessionStorage.getItem("ft.birth"); } catch (e) { /* private mode */ }
    if (!raw) { try { if (localStorage.getItem("ft.birth.keep")) raw = localStorage.getItem("ft.birth"); } catch (e) { /* */ } }
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function fillForm() {
    const b = savedBirth();
    $("we-tz").value = zone();
    if (b && b.date) {
      $("we-date").value = b.date;
      if (b.time && !b.notime) $("we-time").value = b.time;
      const tz = b.zone || (b.place && b.place.tz);
      if (tz) $("we-tz").value = tz;
      if (b.place && typeof b.place.lat === "number" && typeof b.place.lon === "number") { $("we-lat").value = b.place.lat; $("we-lon").value = b.place.lon; }
      $("we-saved").hidden = false;
    }
  }

  // The wheel: Ascendant on the left, longitudes increasing anticlockwise.
  function drawWheel(c) {
    const box = $("we-wheel"); box.textContent = "";
    const size = 420, cx = size / 2, cy = size / 2;
    const asc = c.houses ? c.houses.asc : 0;
    const ang = (lon) => (180 + (lon - asc)) * Math.PI / 180;        // screen angle, anticlockwise from the right
    const pt = (lon, r) => [cx + r * Math.cos(ang(lon)), cy - r * Math.sin(ang(lon))];
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", t("pg.western.wheel.title"));
    const add = (tag, attrs, text) => { const n = document.createElementNS(SVG, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); if (text !== undefined) n.textContent = text; svg.append(n); return n; };
    const R = 200, R2 = 168, R3 = 120;
    add("circle", { cx, cy, r: R, class: "we-ring" }); add("circle", { cx, cy, r: R2, class: "we-ring" }); add("circle", { cx, cy, r: R3, class: "we-ring thin" });
    for (let s = 0; s < 12; s += 1) {
      const [x1, y1] = pt(s * 30, R2), [x2, y2] = pt(s * 30, R);
      add("line", { x1, y1, x2, y2, class: "we-tick" });
      const [gx, gy] = pt(s * 30 + 15, (R + R2) / 2);
      add("text", { x: gx, y: gy, class: "we-sign" + (s % 4 === 0 ? " fire" : s % 4 === 1 ? " earth" : s % 4 === 2 ? " air" : " water") }, SIGN_GLYPH[s]);
    }
    if (c.houses) {
      c.houses.cusps.forEach((cusp, i) => {
        const [x1, y1] = pt(cusp, 36), [x2, y2] = pt(cusp, R2);
        add("line", { x1, y1, x2, y2, class: "we-cusp" + (i % 3 === 0 ? " angle" : "") });
        const next = c.houses.cusps[(i + 1) % 12];
        const mid = cusp + (((next - cusp) % 360) + 360) % 360 / 2;
        const [nx, ny] = pt(mid, 48);
        add("text", { x: nx, y: ny, class: "we-hnum" }, String(i + 1));
      });
      const [ax, ay] = pt(asc, R2 + 1); add("text", { x: ax - 4, y: ay - 8, class: "we-angle" }, "ASC");
      const [mx, my] = pt(c.houses.mc, R2 - 14); add("text", { x: mx, y: my, class: "we-angle" }, "MC");
    }
    // Bodies, nudged apart when close.
    const placed = c.bodies.map((b) => ({ b, at: b.longitude })).sort((a, b) => a.at - b.at);
    for (let pass = 0; pass < 4; pass += 1) {
      for (let i = 0; i < placed.length; i += 1) {
        const a = placed[i], n = placed[(i + 1) % placed.length];
        const gap = ((n.at - a.at) % 360 + 360) % 360;
        if (placed.length > 1 && gap < 7) { a.at -= (7 - gap) / 2; n.at += (7 - gap) / 2; }
      }
    }
    placed.forEach(({ b, at }) => {
      const [x0, y0] = pt(b.longitude, R2); const [x1, y1] = pt(b.longitude, R2 - 8);
      add("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: "we-mark" });
      const [x, y] = pt(at, R2 - 24);
      const g = add("text", { x, y, class: "we-body" + (b.key === "sun" || b.key === "moon" ? " lum" : "") }, GLYPH[b.key]);
      const title = document.createElementNS(SVG, "title"); title.textContent = bodyName(b.key) + " " + place(b.longitude); g.append(title);
    });
    // Aspect lines inside.
    const posOf = Object.fromEntries(c.bodies.map((b) => [b.key, b.longitude]));
    c.aspects.forEach((a) => {
      if (a.kind === "conjunction") return;
      const [x1, y1] = pt(posOf[a.a], R3), [x2, y2] = pt(posOf[a.b], R3);
      add("line", { x1, y1, x2, y2, class: "we-asp " + a.kind });
    });
    box.append(svg);
  }

  function drawTables(c) {
    const rows = $("we-rows"); rows.textContent = "";
    c.bodies.forEach((b) => {
      const tr = el("tr");
      const name = el("td", "we-name"); name.append(el("span", "we-glyph", GLYPH[b.key] + " "), document.createTextNode(bodyName(b.key)));
      tr.append(name, el("td", "", place(b.longitude)), el("td", "we-num", b.house ? String(b.house) : "—"),
        el("td", "", b.key === "sun" || b.key === "moon" ? "—" : t("pg.western.motion." + (b.retrograde ? "retrograde" : "direct"))),
        el("td", "", b.dignity ? t("pg.western.dignity." + b.dignity) : ""));
      rows.append(tr);
    });
    const cusps = $("we-cusps"); cusps.textContent = "";
    const note = $("we-houses-note");
    if (!c.houses) { note.textContent = t("pg.western.houses.none"); return; }
    note.textContent = t("pg.western.houses.system." + c.houses.system) + " · " + t("pg.western.angle.asc") + " " + place(c.houses.asc) + " · " + t("pg.western.angle.mc") + " " + place(c.houses.mc)
      + (c.houses.fell_back ? " — " + t("pg.western.houses.fell_back") : "");
    for (let i = 0; i < 6; i += 1) {
      const tr = el("tr");
      tr.append(el("td", "we-num", String(i + 1)), el("td", "", place(c.houses.cusps[i])), el("td", "we-num", String(i + 7)), el("td", "", place(c.houses.cusps[i + 6])));
      cusps.append(tr);
    }
  }

  function drawAspects(c) {
    const body = $("we-aspects"); body.textContent = "";
    if (!c.aspects.length) { const tr = el("tr"); const td = el("td", "soft", t("pg.western.aspects.none")); td.colSpan = 4; tr.append(td); body.append(tr); return; }
    c.aspects.forEach((a) => {
      const tr = el("tr");
      tr.append(el("td", "", GLYPH[a.a] + " " + bodyName(a.a) + " – " + GLYPH[a.b] + " " + bodyName(a.b)),
        el("td", "we-kind " + a.kind, t("pg.western.aspect." + a.kind) + " (" + a.angle + "°)"), el("td", "we-num", dm(a.orb)), el("td", "we-num", a.allowed + "°"));
      body.append(tr);
    });
  }

  function drawSteps(c) {
    const out = $("we-steps"); out.textContent = "";
    const add = (text) => out.append(el("li", "", text));
    add(t("pg.western.step.time", "", { local: c.moment.local, tz: c.moment.tz, utc: c.moment.utc }));
    add(t("pg.western.step.sky"));
    if (c.houses) {
      const h = c.houses.ramc / 15, hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = Math.round(((h - hh) * 60 - mm) * 60);
      add(t("pg.western.step.ramc", "", { ramc: `${hh}h ${mm}m ${ss}s (${dm(c.houses.ramc)})`, mc: place(c.houses.mc), asc: place(c.houses.asc) }));
      add(t("pg.western.step.houses." + c.houses.system));
    }
    add(t("pg.western.step.aspects"));
  }

  function cast(event) {
    if (event) event.preventDefault();
    const error = $("we-error"); error.hidden = true;
    const date = $("we-date").value, time = $("we-time").value, tz = $("we-tz").value.trim();
    const latRaw = $("we-lat").value, lonRaw = $("we-lon").value;
    const year = Number(date.slice(0, 4));
    const lat = latRaw === "" ? null : Number(latRaw), lon = lonRaw === "" ? null : Number(lonRaw);
    const bad = !date || !time || !tz || year < 1901 || year > 2099 || (lat === null) !== (lon === null)
      || (lat !== null && !(lat >= -90 && lat <= 90)) || (lon !== null && !(lon >= -180 && lon <= 180));
    if (bad) { error.textContent = t("pg.western.error.input"); error.hidden = false; return; }
    const req = { cmd: "western", date, time, tz, houses: $("we-houses").value };
    if (lat !== null) { req.lat = lat; req.lon = lon; }
    let c;
    try { c = engine.call(req); } catch (e) { error.textContent = t("pg.western.error.input"); error.hidden = false; console.error(e); return; }
    $("result").hidden = false;
    const s = (k) => signName(c.bodies.find((b) => b.key === k).sign);
    $("result-title").textContent = c.houses
      ? t("pg.western.title.result", "", { sun: s("sun"), moon: s("moon"), asc: signName(Math.floor(c.houses.asc / 30) % 12) })
      : t("pg.western.title.noplace", "", { sun: s("sun"), moon: s("moon") });
    drawWheel(c); drawTables(c); drawAspects(c); drawSteps(c);
    if (event) $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function init() {
    try {
      language = document.documentElement.dataset.lang || "en";
      const assetRoot = language === "en" ? "../assets/" : "../../assets/";
      [engine, words] = await Promise.all([FTEngine.load(assetRoot + "wasm/ft.wasm"), fetch(assetRoot + "i18n/" + language + ".json", { cache: "no-cache" }).then((r) => r.json())]);
      fillForm();
      $("we-form").addEventListener("submit", cast);
      $("we-houses").addEventListener("change", () => { if ($("we-date").value && $("we-time").value) cast(); });
      $("lang").addEventListener("change", (event) => { const next = event.target.value; location.href = next === "en" ? "/western/" : "/" + next + "/western/"; });
      if ($("we-date").value && $("we-time").value) cast();
    } catch (error) {
      $("we-error").textContent = t("pg.western.error.load", "The calculator could not load. Refresh and try again."); $("we-error").hidden = false; console.error(error);
    }
  }
  init();
})();
