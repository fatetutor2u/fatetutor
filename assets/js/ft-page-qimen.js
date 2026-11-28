/* Fate Tutor 奇門遁甲 page. The Rust engine sets the hour chart in this browser; this file reads
   the form (a moment, or a 局 and hour given directly) and draws the nine palaces. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STEMS = "甲乙丙丁戊己庚辛壬癸", BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
  // The book's drawing: 巽四 離九 坤二 / 震三 中五 兌七 / 艮八 坎一 乾六 (south at the top).
  const LAYOUT = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  const PINYIN = {
    "天蓬": "Peng", "天芮": "Rui", "天沖": "Chong", "天輔": "Fu", "天禽": "Qin", "天心": "Xin", "天柱": "Zhu", "天任": "Ren", "天英": "Ying",
    "休門": "Xiu", "死門": "Si", "傷門": "Shang", "杜門": "Du", "開門": "Kai", "驚門": "Jing", "生門": "Sheng", "景門": "Jing",
    "值符": "Zhifu", "螣蛇": "Tengshe", "太陰": "Taiyin", "六合": "Liuhe", "白虎": "Baihu", "玄武": "Xuanwu", "九地": "Jiudi", "九天": "Jiutian",
  };
  const SIMPLE = { "沖": "冲", "輔": "辅", "門": "门", "傷": "伤", "開": "开", "驚": "惊", "陰": "阴", "兌": "兑", "離": "离" };
  let engine, words = {}, language = "en", last = null;
  const zh = () => language.startsWith("zh");
  const hans = (s) => language === "zh-hans" ? s.replace(/[沖輔門傷開驚陰兌離]/g, (c) => SIMPLE[c]) : s;
  const name = (s) => zh() ? hans(s) : s + (PINYIN[s] ? " " + PINYIN[s] : "");
  const t = (key, fallback, params) => {
    let text = words[key] || fallback || key;
    Object.entries(params || {}).forEach(([k, v]) => { text = text.split("{" + k + "}").join(v); });
    return text;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const pad = (n) => String(n).padStart(2, "0");
  const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } };
  const dun = (yang) => t(yang ? "pg.qimen.dun.yang" : "pg.qimen.dun.yin");
  const method = () => document.querySelector('input[name="method"]:checked').value;
  const PNAME = ["坎", "坤", "震", "巽", "中", "乾", "兌", "艮", "離"];
  const palaceName = (n) => hans(PNAME[n - 1]) + n;

  function setNow() {
    const d = new Date();
    $("qm-date").value = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    $("qm-time").value = pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function fillManual() {
    for (let n = 1; n <= 9; n++) $("qm-m-ju").append(new Option(String(n), String(n)));
    for (let i = 0; i < 60; i++) $("qm-m-hour").append(new Option(STEMS[i % 10] + BRANCHES[i % 12], String(i)));
  }

  function drawFacts(d) {
    const p = d.plate;
    const ju = d.classical ? (d.method === "chaibu" ? d.chaibu : d.classical) : { yang: p.yang, number: p.number };
    $("result-title").textContent = dun(p.yang) + " " + p.number + (zh() ? "局" : "") + " · " + p.hour_zh + (zh() ? "時" : "");
    $("qm-f-ju").textContent = dun(p.yang) + " " + p.number;
    $("qm-f-term").textContent = ju.term_zh ? (zh() ? hans(ju.term_zh) : ju.term_en + " " + ju.term_zh) + " · " + hans(ju.yuan_zh) : "—";
    if (d.block && d.method !== "chaibu") {
      const b = d.block, off = b.offset;
      let s = t(off > 0 ? "pg.qimen.head.ahead" : off < 0 ? "pg.qimen.head.behind" : "pg.qimen.head.exact", "", { head: b.head_zh, date: b.head_date, n: Math.abs(off) });
      if (b.leap) s += " " + t("pg.qimen.head.leap");
      $("qm-f-head").textContent = s;
    } else if (d.moment) {
      $("qm-f-head").textContent = d.moment.day;
    } else $("qm-f-head").textContent = "—";
    $("qm-f-xun").textContent = p.xun_zh + " (" + p.xun_yi_zh + ")";
    $("qm-f-chief").textContent = t("pg.qimen.chief.move", "", { star: name(p.chief_star_zh), from: palaceName(p.chief_from), to: palaceName(p.chief_to) });
    $("qm-f-envoy").textContent = t("pg.qimen.envoy.move", "", { door: name(p.envoy_door_zh), to: palaceName(p.envoy_to) });
    $("qm-f-empty").textContent = p.empty_zh;
    const other = $("qm-other");
    if (d.classical) {
      other.hidden = false;
      if (d.same) { $("qm-other-text").textContent = t("pg.qimen.other.same"); $("qm-other-go").hidden = true; }
      else {
        const o = d.method === "chaibu" ? d.classical : d.chaibu;
        $("qm-other-text").textContent = t(d.method === "chaibu" ? "pg.qimen.other.differs_back" : "pg.qimen.other.differs", "", { dun: dun(o.yang), n: o.number });
        $("qm-other-go").hidden = false;
      }
    } else other.hidden = true;
    const note = $("qm-turn-note");
    note.hidden = !(p.star_turn === 0 || p.star_turn === 4);
    if (!note.hidden) note.textContent = t(p.star_turn === 0 ? "pg.qimen.fuyin" : "pg.qimen.fanyin");
  }

  function drawBoard(p) {
    const board = $("qm-board"); board.textContent = "";
    LAYOUT.forEach((n) => {
      const pal = p.palaces[n - 1];
      const cell = el("div", "qm-cell" + (n === 5 ? " mid" : "") + (n === p.chief_to ? " chief" : "") + (n === p.envoy_to ? " envoy" : ""));
      cell.append(el("span", "qm-pal", palaceName(n)));
      if (pal.god_zh) cell.append(el("span", "qm-god", name(pal.god_zh)));
      const stars = el("div", "qm-stars");
      pal.stars_zh.forEach((s, i) => {
        const row = el("span", "qm-star");
        row.append(el("b", "", name(s)), el("span", "qm-heaven", pal.heaven_zh[i]));
        stars.append(row);
      });
      cell.append(stars);
      if (pal.door_zh) cell.append(el("span", "qm-door", name(pal.door_zh)));
      cell.append(el("span", "qm-earth", pal.earth_zh));
      board.append(cell);
    });
  }

  function show(d, scroll) {
    last = d;
    $("result").hidden = false;
    drawFacts(d); drawBoard(d.plate);
    if (scroll) $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function run(req, scroll) {
    const error = $("qm-error"); error.hidden = true;
    let d;
    try { d = engine.call(req); } catch (e) { error.textContent = t("pg.qimen.error.input"); error.hidden = false; console.error(e); return; }
    show(d, scroll);
  }

  function castMoment(event) {
    if (event) event.preventDefault();
    const date = $("qm-date").value, time = $("qm-time").value, year = Number(date.slice(0, 4));
    if (!date || !time || year < 1901 || year > 2099) { $("qm-error").textContent = t("pg.qimen.error.input"); $("qm-error").hidden = false; return; }
    run({ cmd: "qimen", date, time, tz: zone(), method: method() }, !!event);
  }

  function castManual() {
    run({ cmd: "qimen", yang: $("qm-m-dun").value === "yang", ju: Number($("qm-m-ju").value), hour_cycle: Number($("qm-m-hour").value) }, true);
  }

  async function init() {
    try {
      language = document.documentElement.dataset.lang || "en";
      const assetRoot = language === "en" ? "../assets/" : "../../assets/";
      [engine, words] = await Promise.all([FTEngine.load(assetRoot + "wasm/ft.wasm"), fetch(assetRoot + "i18n/" + language + ".json", { cache: "no-cache" }).then((r) => r.json())]);
      $("qm-tz").textContent = t("pg.qimen.tz", "Time zone: {tz}", { tz: zone() });
      setNow(); fillManual();
      $("qm-form").addEventListener("submit", castMoment);
      $("qm-now").addEventListener("click", () => { setNow(); castMoment(); });
      $("qm-manual-go").addEventListener("click", castManual);
      document.querySelectorAll('input[name="method"]').forEach((r) => r.addEventListener("change", () => castMoment()));
      $("qm-other-go").addEventListener("click", () => {
        const next = method() === "classical" ? "chaibu" : "classical";
        document.querySelector('input[name="method"][value="' + next + '"]').checked = true;
        castMoment();
      });
      $("lang").addEventListener("change", (event) => { const next = event.target.value; location.href = next === "en" ? "/qimen/" : "/" + next + "/qimen/"; });
      castMoment();
    } catch (error) {
      $("qm-error").textContent = t("pg.qimen.error.load", "The calculator could not load. Refresh and try again."); $("qm-error").hidden = false; console.error(error);
    }
  }
  init();
})();
