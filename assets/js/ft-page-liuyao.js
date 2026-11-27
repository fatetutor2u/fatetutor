/* Fate Tutor 六爻 page. Coin throws stay in this browser; the Rust engine lays out the chart. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const lines = [];
  let engine, words = {}, language = "en", chart = null;
  const t = (key, fallback, params) => {
    let text = words[key] || fallback || key;
    Object.entries(params || {}).forEach(([name, value]) => { text = text.split("{" + name + "}").join(value); });
    return text;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const pad = (n) => String(n).padStart(2, "0");
  const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } };
  const secureBit = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] & 1; };
  function toss() { const coins = [secureBit() ? 3 : 2, secureBit() ? 3 : 2, secureBit() ? 3 : 2]; return { coins, value: coins[0] + coins[1] + coins[2] }; }
  const lineLabel = (n) => t("pg.liuyao.line", "Line {n}", { n });
  const coinWord = (n) => n === 3 ? t("pg.liuyao.coin.head", "heads") : t("pg.liuyao.coin.tail", "tails");

  function setNow() {
    const d = new Date();
    $("ly-date").value = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    $("ly-time").value = pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function drawStage() {
    const stage = $("coin-stage"); stage.textContent = "";
    for (let i = 0; i < 6; i++) {
      const item = el("div", "coin-line" + (lines[i] ? "" : " pending"));
      item.append(el("small", "", lineLabel(i + 1)));
      if (lines[i]) {
        item.append(el("b", "", lines[i].value + (lines[i].value === 6 || lines[i].value === 9 ? " ↻" : "")));
        if (lines[i].coins) item.append(el("span", "coins", lines[i].coins.map(coinWord).join(" · ")));
      } else item.append(document.createTextNode("—"));
      stage.append(item);
    }
    const complete = lines.length === 6;
    $("throw-one").disabled = complete; $("throw-all").disabled = complete;
    $("cast-status").textContent = complete ? t("pg.liuyao.complete", "Six lines cast") : t("pg.liuyao.count", "{n} of 6 lines", { n: lines.length });
  }

  function manualInputs() {
    const root = $("ly-manual-lines"); root.textContent = "";
    for (let i = 1; i <= 6; i++) {
      const label = el("label"); label.append(el("span", "", lineLabel(i)));
      const select = el("select"); select.id = "ly-manual-" + i;
      [7, 8, 9, 6].forEach((v) => { const o = el("option", "", t("pg.liuyao.value." + v, String(v))); o.value = v; select.append(o); });
      label.append(select); root.append(label);
    }
  }

  const gz = (s) => s.stem + s.branch + s.element_zh;
  const hexName = (h) => "#" + h.number + " · " + h.name_zh + " · " + h.pinyin;

  function calculate() {
    const error = $("ly-error"); error.hidden = true;
    const date = $("ly-date").value, time = $("ly-time").value;
    if (!date || !time) { error.textContent = t("pg.liuyao.error.input"); error.hidden = false; return; }
    try {
      chart = engine.call({ cmd: "liuyao", lines: lines.map((x) => x.value), date, time, tz: zone() });
    } catch (e) { error.textContent = t("pg.liuyao.error.input"); error.hidden = false; console.error(e); return; }
    $("result").hidden = false;
    $("result-title").textContent = hexName(chart.original) + (chart.changed ? " → " + hexName(chart.changed) : "");
    const p = chart.palace;
    $("ly-palace").textContent = t("pg.liuyao.palace.line", "", { palace: p.trigram_zh, element: p.element_zh, place: language.startsWith("zh") ? t("pg.liuyao.place." + p.place) : p.place_zh + " · " + t("pg.liuyao.place." + p.place) });
    $("ly-month").textContent = chart.moment ? chart.moment.month : chart.month_branch;
    $("ly-day").textContent = chart.moment ? chart.moment.day : chart.day_stem + chart.day_branch;
    $("ly-void").textContent = chart.void_branches.join("");
    $("ly-clash").hidden = !chart.six_clash;
    showTopic();
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function yongLines(topic) {
    if (topic === "self") return chart.lines.filter((l) => l.shi);
    if (topic === "other") return chart.lines.filter((l) => l.ying);
    return chart.lines.filter((l) => l.relative === topic);
  }

  function drawRows(picked) {
    const body = $("ly-rows"); body.textContent = "";
    chart.lines.slice().reverse().forEach((l) => {
      const row = el("tr", picked.includes(l.position) ? "yong" : "");
      row.append(el("td", "", l.spirit_zh));
      row.append(el("td", "hid", l.hidden ? l.hidden.relative_zh + " " + gz(l.hidden) : ""));
      row.append(el("td", "", l.relative_zh + " " + gz(l)));
      const bar = el("td"); bar.append(el("span", "ly-bar" + (l.yang ? "" : " yin") + (l.moving ? " moving" : "")));
      if (l.moving) bar.append(el("span", "ly-move", l.yang ? "○" : "×"));
      row.append(bar);
      row.append(el("td", "ly-mark", l.shi ? t("pg.liuyao.shi", "世") : l.ying ? t("pg.liuyao.ying", "應") : ""));
      row.append(el("td", "ch", l.changed ? l.changed.relative_zh + " " + gz(l.changed) : ""));
      const notes = [];
      if (l.void) notes.push(t("pg.liuyao.note.void"));
      if (l.month_broken) notes.push(t("pg.liuyao.note.broken"));
      if (l.day_clash) notes.push(t("pg.liuyao.note.clash"));
      row.append(el("td", "notes", notes.join(" · ")));
      body.append(row);
    });
  }

  function showTopic() {
    if (!chart) return;
    const topic = document.querySelector('input[name="topic"]:checked').value;
    $("ly-topic-quote").textContent = t("pg.liuyao.quote.topic." + topic);
    const found = yongLines(topic);
    const root = $("ly-yong"); root.textContent = "";
    found.forEach((l) => {
      const card = el("article");
      card.append(el("b", "", t("pg.liuyao.yong.line", "", { n: l.position, rel: l.relative_zh, gz: l.stem + l.branch, el: l.element_zh })));
      card.append(el("p", "", t("pg.liuyao.month." + l.month_effect)));
      card.append(el("p", "", t("pg.liuyao.day." + l.day_effect)));
      if (l.void) card.append(el("p", "", t("pg.liuyao.yong.void")));
      if (l.month_broken) card.append(el("p", "", t("pg.liuyao.yong.broken")));
      if (l.day_clash) card.append(el("p", "", t("pg.liuyao.yong.clash")));
      if (l.changed) card.append(el("p", "", t("pg.liuyao.yong.moving", "", { to: l.changed.relative_zh + " " + gz(l.changed) })));
      root.append(card);
    });
    let picked = found.map((l) => l.position);
    if (!found.length) {
      chart.lines.filter((l) => l.hidden && l.hidden.relative === topic).forEach((l) => {
        const card = el("article");
        card.append(el("b", "", t("pg.liuyao.yong.hidden", "", { rel: l.hidden.relative_zh, n: l.position, gz: l.hidden.stem + l.hidden.branch, el: l.hidden.element_zh })));
        root.append(card); picked.push(l.position);
      });
    }
    drawRows(picked);
  }

  function throwOne() { if (lines.length >= 6) return; lines.push(toss()); drawStage(); if (lines.length === 6) calculate(); }

  async function init() {
    try {
      language = document.documentElement.dataset.lang || "en";
      const assetRoot = language === "en" ? "../assets/" : "../../assets/";
      [engine, words] = await Promise.all([FTEngine.load(assetRoot + "wasm/ft.wasm"), fetch(assetRoot + "i18n/" + language + ".json", { cache: "no-cache" }).then((r) => r.json())]);
      setNow(); manualInputs(); drawStage();
      $("ly-tz").textContent = t("pg.liuyao.tz", "Time zone: {tz}", { tz: zone() });
      $("throw-one").addEventListener("click", throwOne);
      $("throw-all").addEventListener("click", () => { while (lines.length < 6) lines.push(toss()); drawStage(); calculate(); });
      $("reset-cast").addEventListener("click", () => { lines.length = 0; chart = null; $("result").hidden = true; setNow(); drawStage(); });
      $("ly-manual-go").addEventListener("click", () => {
        lines.length = 0;
        for (let i = 1; i <= 6; i++) lines.push({ value: Number($("ly-manual-" + i).value) });
        drawStage(); calculate();
      });
      document.querySelectorAll('input[name="topic"]').forEach((x) => x.addEventListener("change", showTopic));
      $("lang").addEventListener("change", (event) => { const next = event.target.value; location.href = next === "en" ? "/liuyao/" : "/" + next + "/liuyao/"; });
    } catch (error) {
      $("ly-error").textContent = t("pg.liuyao.error.load", "The calculator could not load. Refresh and try again."); $("ly-error").hidden = false; console.error(error);
    }
  }
  init();
})();
