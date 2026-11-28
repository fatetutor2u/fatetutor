/* Fate Tutor 協紀辨方書 almanac page. The Rust engine works the day out in this browser; this file
   reads the date, shows the everyday 宜 and 忌 (卷十一 民用), the spirits, the 卷十 rulings that
   decided, the steps, and the court list. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let engine, words = {}, language = "en";
  // 卷十一 民用三十七事 shown on the page; 療病 破土 安葬 啟攢 are worked out but not shown (site rules).
  const HIDDEN = ["療病", "破土", "安葬", "啟攢"];
  const COURT_HIDDEN = ["求醫療病", "療目", "針刺", "破土", "安葬", "啟攢"];
  const t = (key, fallback, params) => {
    let text = words[key] || fallback || key;
    Object.entries(params || {}).forEach(([name, value]) => { text = text.split("{" + name + "}").join(value); });
    return text;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const ev = (name) => t("pg.almanac.ev." + name, name);

  function list(box, names, empty) {
    box.textContent = "";
    if (!names.length) { box.append(el("p", "soft", empty)); return; }
    const ul = el("ul", "al-list");
    names.forEach((n) => ul.append(el("li", "", ev(n))));
    box.append(ul);
  }

  function show(event) {
    if (event) event.preventDefault();
    const error = $("al-error"); error.hidden = true;
    const date = $("al-date").value;
    const y = Number(date.slice(0, 4));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || y < 1900 || y > 2100) { error.textContent = t("pg.almanac.error.input"); error.hidden = false; return; }
    let r;
    try { r = engine.call({ cmd: "almanac", date }); } catch (e) { error.textContent = t("pg.almanac.error.input"); error.hidden = false; console.error(e); return; }
    const j = r.judgement;
    $("result").hidden = false;
    $("result-title").textContent = t("pg.almanac.title.result", "{date} · {gz}", { date: r.date, gz: r.day_gz });
    $("al-facts").textContent = t("pg.almanac.facts", "", {
      month: r.month.name, mgz: r.month_gz, jie: r.month.jie, n: r.month.jie_days, lm: (r.lunar.is_leap ? "閏" : "") + r.lunar.month, ld: r.lunar.day,
      ygz: r.year_gz, off: j.officer, nayin: j.nayin, cls: j.class,
    }) + " " + t("pg.almanac.officer.note", "", { off: j.officer, gloss: t("pg.almanac.off." + j.officer, j.officer) });
    const yi = r.everyday.yi.filter((n) => !HIDDEN.includes(n));
    const ji = r.everyday.ji.filter((n) => !HIDDEN.includes(n));
    if (j.all_ji) {
      const box = $("al-ji"); box.textContent = "";
      box.append(el("p", "al-all", t("pg.almanac.all")));
      const allowed = j.all_ji_except.map((n) => ({ 整容剃頭: "剃頭" }[n] || n)).filter((n) => words["pg.almanac.ev." + n]);
      if (allowed.length) box.append(el("p", "soft small", t("pg.almanac.all.except", "", { list: allowed.map(ev).join(language.startsWith("zh") ? "、" : ", ") })));
      list($("al-yi"), yi, t("pg.almanac.none"));
    } else {
      list($("al-yi"), yi, t("pg.almanac.none"));
      list($("al-ji"), ji, t("pg.almanac.none"));
    }
    $("al-good").textContent = j.good.join("　") || "—";
    $("al-bad").textContent = j.bad.join("　") || "—";
    const rl = $("al-rulings"); rl.textContent = "";
    j.rulings.forEach((x) => {
      const li = el("li");
      li.append(el("b", "", x.spirit), el("span", "", " — " + t("pg.almanac.outcome." + x.outcome, x.outcome)), el("span", "mh-quote-inline", " 「" + x.quote + "」"));
      rl.append(li);
    });
    if (!j.rulings.length) rl.append(el("li", "soft", t("pg.almanac.none")));
    const steps = $("al-steps"); steps.textContent = "";
    const add = (k, p) => steps.append(el("li", "", t(k, "", p)));
    add("pg.almanac.step.month", { jie: r.month.jie, n: r.month.jie_days, month: r.month.name, mb: r.month.branch, vol: r.month.volume });
    add("pg.almanac.step.officer", { b: r.day_gz.slice(1), mb: r.month.branch, off: j.officer });
    add("pg.almanac.step.spirits", { good: j.good.length, bad: j.bad.length });
    add("pg.almanac.step.weigh", {});
    $("al-cyi").textContent = j.yi.filter((n) => !COURT_HIDDEN.includes(n)).join("　") || "—";
    $("al-cji").textContent = j.all_ji ? "諸事皆忌" : (j.ji.filter((n) => !COURT_HIDDEN.includes(n)).join("　") || "—");
    if (event) $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function shift(days) {
    const d = new Date($("al-date").value + "T12:00:00");
    if (isNaN(d)) return;
    d.setDate(d.getDate() + days);
    $("al-date").value = iso(d);
    show();
  }

  async function init() {
    try {
      language = document.documentElement.dataset.lang || "en";
      const root = language === "en" ? "../assets/" : "../../assets/";
      [engine, words] = await Promise.all([FTEngine.load(root + "wasm/ft.wasm"), fetch(root + "i18n/" + language + ".json", { cache: "no-cache" }).then((r) => r.json())]);
      $("al-form").addEventListener("submit", show);
      $("al-today").addEventListener("click", () => { $("al-date").value = iso(new Date()); show(); });
      $("al-prev").addEventListener("click", () => shift(-1));
      $("al-next").addEventListener("click", () => shift(1));
      $("lang").addEventListener("change", (event) => { const next = event.target.value; location.href = next === "en" ? "/almanac/" : "/" + next + "/almanac/"; });
      $("al-date").value = iso(new Date());
      show();
    } catch (error) {
      $("al-error").textContent = t("pg.almanac.error.load", "The calculator could not load. Refresh and try again."); $("al-error").hidden = false; console.error(error);
    }
  }
  init();
})();
