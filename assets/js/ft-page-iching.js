/* Fate Tutor I Ching page. Coin casts and Rust calculation stay in this browser. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const lines = [];
  let engine, texts = {}, words = {}, language = "en";
  const t = (key, fallback, params) => {
    let text = words[key] || fallback;
    Object.entries(params || {}).forEach(([name, value]) => { text = text.replaceAll("{" + name + "}", value); });
    return text;
  };
  const lineLabel = (n) => t("pg.iching.line." + n, "Line " + n, { n });
  const coinWord = (n) => n === 3 ? t("pg.iching.coin.head", "heads") : t("pg.iching.coin.tail", "tails");
  const secureBit = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] & 1; };
  function toss() { const coins = [secureBit() ? 3 : 2, secureBit() ? 3 : 2, secureBit() ? 3 : 2]; return { coins, value: coins[0] + coins[1] + coins[2] }; }
  function drawStage() {
    const stage = $("coin-stage"); stage.textContent = "";
    for (let i = 0; i < 6; i++) {
      const item = document.createElement("div"); item.className = "coin-line" + (lines[i] ? "" : " pending");
      const label = document.createElement("small"); label.textContent = lineLabel(i + 1);
      item.append(label);
      if (lines[i]) {
        const value = document.createElement("b"); value.textContent = lines[i].value + (lines[i].value === 6 || lines[i].value === 9 ? " ↻" : "");
        const coins = document.createElement("span"); coins.className = "coins"; coins.textContent = lines[i].coins.map(coinWord).join(" · ");
        item.append(value, coins);
      } else item.append(document.createTextNode("—"));
      stage.append(item);
    }
    const complete = lines.length === 6;
    $("throw-one").disabled = complete; $("throw-all").disabled = complete;
    $("cast-status").textContent = complete ? t("pg.iching.cast.complete", "Six lines cast") : t("pg.iching.cast.count", lines.length + " of 6 lines", { n: lines.length });
  }
  function hex(id, hexagram, moving) {
    const root = $(id); root.textContent = "";
    for (let i = 5; i >= 0; i--) { const line = document.createElement("div"); line.className = "hex-line" + (((hexagram.pattern >> i) & 1) ? "" : " yin") + (moving && moving.includes(i + 1) ? " moving" : ""); root.append(line); }
  }
  function name(hexagram) { return "#" + hexagram.number + " · " + hexagram.name_zh + " · " + hexagram.pinyin; }
  function ruleText(rule) {
    return t(rule.text_key, rule.kind.replaceAll("_", " "), { lines: rule.line_positions.join(", ") });
  }
  function showSource(cast) {
    const data = texts[String(cast.original.number)]; if (!data) return;
    $("source-name").textContent = "#" + cast.original.number + " · " + data.name_zh;
    $("source-judgement").textContent = data.judgement;
    const linesOut = $("source-lines"); linesOut.textContent = "";
    const requested = cast.reading_rule.line_positions;
    const showAll = cast.reading_rule.kind === "moving_line" || cast.reading_rule.kind === "two_moving_lines_upper_first";
    data.lines.forEach((text, i) => {
      const row = document.createElement("div"); row.className = "source-line" + ((showAll && requested.includes(i + 1)) ? " pick" : "");
      row.textContent = (i < 6 ? lineLabel(i + 1) + " · " : t("pg.iching.use", "Use" ) + " · ") + text; linesOut.append(row);
    });
  }
  const TERMS = [
    ["元亨", "opening"], ["利貞", "steadiness"], ["无咎", "no_blame"], ["無咎", "no_blame"],
    ["有悔", "reconsider"], ["悔", "reconsider"], ["有孚", "sincerity"], ["孚", "sincerity"],
    ["征", "pressing_on"], ["凶", "warning"], ["吉", "favourable"], ["利", "benefit"], ["貞", "steadiness"],
  ];
  function termsInPassage(text) {
    const matches = [];
    TERMS.forEach(([word, key], order) => {
      let start = text.indexOf(word);
      while (start !== -1) {
        matches.push({ word, key, start, order });
        start = text.indexOf(word, start + word.length);
      }
    });
    matches.sort((a, b) => a.start - b.start || b.word.length - a.word.length || a.order - b.order);
    const used = new Set();
    return matches.filter(({ key }) => !used.has(key) && used.add(key));
  }
  function selectedPassages(cast) {
    const original = texts[String(cast.original.number)], resulting = texts[String(cast.resulting.number)];
    const make = (data, label, text) => ({ label, text, data });
    const kind = cast.reading_rule.kind;
    if (kind === "original_judgement") return [make(original, t("pg.iching.original", "Original hexagram"), original.judgement)];
    if (kind === "moving_line" || kind === "two_moving_lines_upper_first") return cast.reading_rule.line_positions.map((position) => make(original, lineLabel(position), original.lines[position - 1] || ""));
    if (kind === "both_judgements") return [make(original, t("pg.iching.original", "Original hexagram"), original.judgement), make(resulting, t("pg.iching.resulting", "Resulting hexagram"), resulting.judgement)];
    if (kind === "resulting_unchanged_lines" || kind === "resulting_unchanged_line") return cast.reading_rule.line_positions.map((position) => make(resulting, lineLabel(position), resulting.lines[position - 1] || ""));
    if (kind === "use_nine" || kind === "use_six") return [make(original, t("pg.iching.use", "Use"), original.lines[6] || original.judgement)];
    return [make(resulting, t("pg.iching.resulting", "Resulting hexagram"), resulting.judgement)];
  }
  function drawPlain(cast) {
    const root = $("plain-reading"); root.textContent = "";
    selectedPassages(cast).forEach((passage) => {
      const card = document.createElement("article"); card.className = "plain-card";
      const heading = document.createElement("b"); heading.textContent = passage.label + " · " + passage.data.name_zh;
      const source = document.createElement("p"); source.textContent = passage.text;
      const found = termsInPassage(passage.text);
      const summary = document.createElement("p");
      summary.textContent = found.length
        ? t("pg.iching.plain.read_terms", "Everyday wording: {terms}.", { terms: found.map(({ key }) => t("pg.iching.plain.term." + key, key)).join("; ") })
        : t("pg.iching.plain.read_image", "Everyday wording: this passage speaks through an image. Read it slowly as an image for reflection, not as a forecast.");
      const tags = document.createElement("div"); tags.className = "plain-tags";
      (found.length ? found : [{ key: "image" }]).forEach(({ key }) => { const tag = document.createElement("span"); tag.textContent = t("pg.iching.plain.term." + key, key); tags.append(tag); });
      card.append(heading, source, summary, tags); root.append(card);
    });
  }
  function calculate() {
    const cast = engine.call({ cmd: "iching", lines: lines.map((x) => x.value) });
    $("result").hidden = false; $("result-title").textContent = name(cast.original); $("result-rule").textContent = ruleText(cast.reading_rule);
    hex("hex-original", cast.original, cast.changing_lines); hex("hex-resulting", cast.resulting); hex("hex-inner", cast.inner);
    $("original-name").textContent = name(cast.original); $("resulting-name").textContent = name(cast.resulting); $("inner-name").textContent = name(cast.inner);
    showSource(cast); drawPlain(cast); $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function throwOne() { if (lines.length >= 6) return; lines.push(toss()); drawStage(); if (lines.length === 6) calculate(); }
  async function init() {
    try {
      language = document.documentElement.dataset.lang || "en";
      const assetRoot = language === "en" ? "../assets/" : "../../assets/";
      [engine, texts, words] = await Promise.all([FTEngine.load(assetRoot + "wasm/ft.wasm"), fetch(assetRoot + "iching/texts.json").then((r) => { if (!r.ok) throw Error("texts"); return r.json(); }), fetch(assetRoot + "i18n/" + language + ".json").then((r) => r.json())]);
      drawStage(); $("throw-one").addEventListener("click", throwOne); $("throw-all").addEventListener("click", () => { while (lines.length < 6) lines.push(toss()); drawStage(); calculate(); });
      $("reset-cast").addEventListener("click", () => { lines.length = 0; $("result").hidden = true; drawStage(); });
      $("lang").addEventListener("change", (event) => { const next = event.target.value; location.href = next === "en" ? "/iching/" : "/" + next + "/iching/"; });
    } catch (error) { $("cast-status").textContent = t("pg.iching.cast.error", "The calculator could not load. Refresh and try again."); console.error(error); }
  }
  init();
})();
