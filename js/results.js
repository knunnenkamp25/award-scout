/* Best Options tab: rank destinations by real prices from data/*.json
   (fetched on a schedule by the GitHub Action). */

const PROGRAM_INFO = {
  delta:          { label: "Delta SkyMiles",     amex: true,  url: "https://www.delta.com/flight-search/book-a-flight" },
  flyingblue:     { label: "Flying Blue",        amex: true,  url: "https://wwws.airfrance.us/" },
  virginatlantic: { label: "Virgin Atlantic",    amex: true,  url: "https://www.virginatlantic.com/" },
  aeroplan:       { label: "Aeroplan",           amex: true,  url: "https://www.aircanada.com/aeroplan" },
  british:        { label: "BA Avios",           amex: true,  url: "https://www.britishairways.com/" },
  iberia:         { label: "Iberia Avios",       amex: true,  url: "https://www.iberia.com/" },
  qantas:         { label: "Qantas",             amex: true,  url: "https://www.qantas.com/" },
  etihad:         { label: "Etihad",             amex: true,  url: "https://www.etihadguest.com/" },
  emirates:       { label: "Emirates",           amex: true,  url: "https://www.emirates.com/" },
  singapore:      { label: "KrisFlyer",          amex: true,  url: "https://www.singaporeair.com/" },
  lifemiles:      { label: "LifeMiles",          amex: true,  url: "https://www.lifemiles.com/" },
  qatar:          { label: "Qatar Avios",        amex: true,  url: "https://www.qatarairways.com/" },
  united:         { label: "United MileagePlus", amex: false, url: "https://www.united.com/" },
  american:       { label: "AA AAdvantage",      amex: false, url: "https://www.aa.com/" },
  alaska:         { label: "Alaska Mileage Plan",amex: false, url: "https://www.alaskaair.com/" },
  turkish:        { label: "Turkish Miles&Smiles", amex: false, url: "https://www.turkishairlines.com/" },
  eurobonus:      { label: "SAS EuroBonus",      amex: false, url: "https://www.flysas.com/" },
};
function programInfo(id) {
  return PROGRAM_INFO[id] || { label: id, amex: false, url: null };
}

const DATA = { config: null, cash: null, awards: null };

// Ground alternatives from home for positioning (shown when no award hop fits).
const TRAIN_FROM_HOME = {
  DCA: "Amtrak ~2.5h", BWI: "Amtrak ~3h", IAD: "Amtrak+metro ~3.5h",
  PHL: "Amtrak ~4h", EWR: "Amtrak ~5.5h", JFK: "Amtrak to NYC ~6h",
};

async function loadJson(path) {
  try {
    const res = await fetch(path + "?t=" + Date.now());
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function nightsBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}
function shortDate(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}
function fmtMiles(n) {
  return n >= 1000 ? Math.round(n / 1000) + "k" : String(n);
}

/* ---------- per-destination computation ---------- */
// WIN is the currently selected travel window; set by renderBest.
let WIN = null;

// Transfer bonus: {program, pct} or null. Effective miles = miles / (1+pct).
let BONUS = JSON.parse(localStorage.getItem("awardscout.bonus") || "null");
function effLegMiles(e) {
  return BONUS && e.program === BONUS.program ? e.miles / (1 + BONUS.pct / 100) : e.miles;
}

// `origins` is a list: pass all home airports for "Any airport" mode.
function bestCash(origins, dest) {
  if (!DATA.cash || !WIN) return null;
  const { min, max } = WIN.nights;
  let best = null;
  for (const e of DATA.cash.entries) {
    if (!origins.includes(e.origin) || e.dest !== dest || !e.price) continue;
    if (e.dep < WIN.start || e.dep > WIN.end) continue;
    const n = nightsBetween(e.dep, e.ret);
    if (n < min || n > max) continue;
    if (!best || e.price < best.price) best = e;
  }
  return best;
}

function awardLegs(origins, dest, direction, cabin, opts) {
  return DATA.awards.entries.filter((e) => {
    if (e.date < WIN.start || e.date > WIN.end) return false;
    const home = direction === "out" ? e.origin : e.dest;
    const away = direction === "out" ? e.dest : e.origin;
    if (!origins.includes(home) || away !== dest || e.cabin !== cabin) return false;
    if (opts.nonstop && !e.direct) return false;
    if (opts.seatsNeeded && e.seats > 0 && e.seats < opts.seatsNeeded) return false;
    if (!opts.allPrograms && !programInfo(e.program).amex) return false;
    if (opts.program && e.program !== opts.program) return false;
    return true;
  });
}

// Best round trip = cheapest outbound + cheapest return that fit the
// nights range, judged on EFFECTIVE miles (transfer bonus applied).
// One-way awards book independently, so programs may differ — and in
// "Any airport" mode the return may land at a different home airport.
function bestAward(origins, dest, cabin, opts) {
  if (!DATA.awards || !WIN) return null;
  const { min, max } = WIN.nights;
  const outs = awardLegs(origins, dest, "out", cabin, opts);
  const rets = awardLegs(origins, dest, "ret", cabin, opts);
  let best = null;
  for (const o of outs) {
    for (const r of rets) {
      const n = nightsBetween(o.date, r.date);
      if (n < min || n > max) continue;
      const eff = effLegMiles(o) + effLegMiles(r);
      if (!best || eff < best.eff) {
        best = { miles: o.miles + r.miles, eff, taxes: (o.taxes ?? 0) + (r.taxes ?? 0), out: o, ret: r };
      }
    }
  }
  return best;
}

// Cheapest economy award hop between home and a hub, on the leg date or with
// a one-day overnight buffer on the correct side.
function positioningHop(hub, legDate, dir) {
  const home = DATA.config?.home;
  if (!DATA.awards || !home || hub === home) return null;
  let best = null;
  for (const e of DATA.awards.entries) {
    if (e.cabin !== "economy") continue;
    if (dir === "out" ? e.origin !== home || e.dest !== hub : e.origin !== hub || e.dest !== home) continue;
    const offset = nightsBetween(legDate, e.date); // e.date - legDate in days
    if (dir === "out" ? offset < -1 || offset > 0 : offset < 0 || offset > 1) continue;
    if (!best || e.miles < best.miles) best = e;
  }
  return best;
}

function positioningLine(a) {
  const home = DATA.config?.home;
  if (!home) return "";
  const parts = [];
  let extraMiles = 0;
  let allAward = true;
  for (const [leg, hub, date, dir] of [
    ["out", a.out.origin, a.out.date, "out"],
    ["back", a.ret.dest, a.ret.date, "ret"],
  ]) {
    if (hub === home) continue;
    const hop = positioningHop(hub, date, dir);
    if (hop) {
      extraMiles += hop.miles;
      parts.push(`${leg}: +${fmtMiles(hop.miles)} ${dir === "out" ? home + "→" + hub : hub + "→" + home} ${shortDate(hop.date)}`);
    } else {
      allAward = false;
      parts.push(`${leg}: ${TRAIN_FROM_HOME[hub] || "short cash flight"} to ${dir === "out" ? hub : home}`);
    }
  }
  if (!parts.length) return ""; // already starts and ends at home
  const total = allAward && extraMiles ? ` · ≈ ${fmtMiles(a.miles + extraMiles)} total from ${home}` : "";
  return `<div class="price-sub pos-line">🏠 ${parts.join(" · ")}${total}</div>`;
}

/* ---------- date grid (calendar heatmap of award prices) ---------- */
// Sequential ramp bins q0 (cheapest) → q4 (priciest); colors live in CSS so
// dark mode can re-map the ramp against its own surface.
function dateGridHtml(dest, opts, origins) {
  const dirs = [["Outbound", "out"], ["Return", "ret"]];
  const byDir = {};
  const allVals = [];
  for (const [, dir] of dirs) {
    const map = {};
    for (const e of awardLegs(origins, dest, dir, opts.cabin, opts)) {
      if (!map[e.date] || effLegMiles(e) < effLegMiles(map[e.date])) map[e.date] = e;
    }
    byDir[dir] = map;
    for (const e of Object.values(map)) allVals.push(effLegMiles(e));
  }
  if (!allVals.length) return '<p class="hint">No award space matches the current filters in this window.</p>';
  const sorted = [...allVals].sort((x, y) => x - y);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const cuts = [q(0.2), q(0.4), q(0.6), q(0.8)];
  const binOf = (v) => (v <= cuts[0] ? 0 : v <= cuts[1] ? 1 : v <= cuts[2] ? 2 : v <= cuts[3] ? 3 : 4);

  const days = [];
  for (let d = new Date(WIN.start + "T00:00:00Z"); fmt(d) <= WIN.end; d = addDays(d, 1)) days.push(fmt(d));

  let html =
    '<div class="grid-legend">cheapest <span class="gl q0"></span><span class="gl q1"></span><span class="gl q2"></span><span class="gl q3"></span><span class="gl q4"></span> priciest · ○ nonstop · ◎ best day</div>';
  for (const [label, dir] of dirs) {
    const vals = Object.values(byDir[dir]).map(effLegMiles);
    const dirMin = vals.length ? Math.min(...vals) : null;
    html += `<div class="cal-title">${label}</div><div class="cal">`;
    html += ["S", "M", "T", "W", "T", "F", "S"].map((w) => `<div class="cal-h">${w}</div>`).join("");
    html += '<div class="cal-pad"></div>'.repeat(new Date(days[0] + "T00:00:00Z").getUTCDay());
    for (const date of days) {
      const [, m, dnum] = date.split("-");
      const dayLabel = dnum === "01" || date === days[0] ? `${Number(m)}/${Number(dnum)}` : Number(dnum);
      const e = byDir[dir][date];
      if (!e) {
        html += `<div class="cal-c empty" title="${date}: no award space">${dayLabel}</div>`;
        continue;
      }
      const eff = effLegMiles(e);
      const info = programInfo(e.program);
      const title = `${date}: ${fmtMiles(Math.round(eff))} miles ${info.label}${dir === "out" ? " from " + e.origin : " into " + e.dest}${e.direct ? " · nonstop" : ""}${e.seats ? ` · ${e.seats}+ seats` : ""}`;
      html += `<div class="cal-c q${binOf(eff)}${eff === dirMin ? " best" : ""}" title="${title}"><span class="cal-d">${dayLabel}</span><span class="cal-m">${fmtMiles(Math.round(eff))}</span>${e.direct ? '<span class="cal-ns">○</span>' : ""}</div>`;
    }
    html += "</div>";
  }
  return html;
}

/* ---------- book-now-vs-wait (history percentile) ---------- */
function trendBadge(code, cabin, currentMiles) {
  if (!DATA.history || !WIN || currentMiles == null) return "";
  const key = cabin === "business" ? "b" : "e";
  const series = DATA.history.map((l) => l.windows?.[WIN.id]?.[code]?.[key]?.m).filter(Boolean);
  if (series.length < 14) return "";
  const pct = series.filter((v) => v <= currentMiles).length / series.length;
  if (pct <= 0.2)
    return `<span class="trend-badge good" title="Current best is cheaper than ${Math.round((1 - pct) * 100)}% of ${series.length} tracked snapshots">📊 cheapest ${Math.max(1, Math.round(pct * 100))}% ever tracked — book</span>`;
  if (pct >= 0.8)
    return `<span class="trend-badge" title="Cheaper prices appeared in ${Math.round((1 - pct) * 100)}% of ${series.length} snapshots">📊 pricier than usual — can wait</span>`;
  return "";
}

/* ---------- shareable view (URL hash ↔ controls) ---------- */
function syncHash() {
  const p = new URLSearchParams({
    w: $("#best-window").value,
    o: $("#best-origin").value,
    r: $("#best-region").value,
    c: $("#best-cabin").value,
    s: $("#best-sort").value,
  });
  if ($("#best-nonstop").checked) p.set("ns", "1");
  if (!$("#best-seats").checked) p.set("st", "0");
  if ($("#best-allprograms").checked) p.set("ap", "1");
  if (BONUS) { p.set("bp", BONUS.program); p.set("bx", String(BONUS.pct)); }
  history.replaceState(null, "", "#" + p.toString());
}
function applyHash() {
  if (location.hash.length < 2) return;
  const p = new URLSearchParams(location.hash.slice(1));
  const set = (sel, v) => { if (v != null) $(sel).value = v; };
  set("#best-window", p.get("w"));
  set("#best-origin", p.get("o"));
  set("#best-region", p.get("r"));
  set("#best-cabin", p.get("c"));
  set("#best-sort", p.get("s"));
  $("#best-nonstop").checked = p.get("ns") === "1";
  if (p.has("st")) $("#best-seats").checked = p.get("st") !== "0";
  $("#best-allprograms").checked = p.get("ap") === "1";
  if (p.get("bp")) { $("#bonus-program").value = p.get("bp"); $("#bonus-pct").value = p.get("bx") || "30"; }
}

/* ---------- rendering ---------- */
function bestControls() {
  return {
    origin: $("#best-origin").value,
    region: $("#best-region").value,
    cabin: $("#best-cabin").value,
    sort: $("#best-sort").value,
    nonstop: $("#best-nonstop").checked,
    seatsNeeded: $("#best-seats").checked ? (DATA.config?.adults ?? 2) : 0,
    allPrograms: $("#best-allprograms").checked,
  };
}

function renderBanner() {
  const el = $("#data-banner");
  const isSample = DATA.cash?.sample || DATA.awards?.sample;
  if (!DATA.cash && !DATA.awards) {
    el.innerHTML =
      '<div class="banner warn"><strong>No price data yet.</strong> The GitHub Action needs API keys — see the README\'s setup section. Until then, use the Manual Search tab.</div>';
    return;
  }
  if (isSample) {
    el.innerHTML =
      `<div class="banner warn"><strong>⚠️ ${DATA.awards?.sample ? "Award prices are sample data" : "Some prices are sample data"}</strong> — the next successful "Refresh price data" run replaces them with real seats.aero availability.</div>`;
  } else {
    const when = new Date(DATA.awards?.generated || DATA.cash?.generated);
    const hrs = Math.round((Date.now() - when) / 3600000);
    el.innerHTML = `<div class="banner ok">Prices refreshed ${hrs <= 1 ? "within the last hour" : hrs + " hours ago"}</div>`;
  }
  const home = DATA.config?.home;
  if (home) {
    el.innerHTML += `<div class="banner tip">🏠 Booking from ${home}: before paying for a positioning hop, search the winning program <em>from ${home}</em> — award tickets usually include the domestic connector on one protected ticket for little or no extra miles. The "🏠" line on each card is the fallback plan.</div>`;
  }
}

/* ---------- watchlist ---------- */
const LS_WATCH = "awardscout.watch";
let watchlist = JSON.parse(localStorage.getItem(LS_WATCH) || "[]");

function watchKey(dest, cabin) {
  return dest + "|" + cabin;
}
function toggleWatch(dest, cabin, current) {
  const key = watchKey(dest, cabin);
  const i = watchlist.findIndex((w) => w.key === key);
  if (i >= 0) watchlist.splice(i, 1);
  else
    watchlist.push({
      key, dest, cabin,
      miles: current.award?.miles ?? null,
      taxes: current.award ? Math.round(current.award.taxes) : null,
      cash: current.cash ? Math.round(current.cash.price) : null,
      program: current.award?.out.program ?? null,
      when: new Date().toISOString(),
    });
  localStorage.setItem(LS_WATCH, JSON.stringify(watchlist));
  renderBest();
}

function watchSection(opts, origins) {
  if (!watchlist.length) return null;
  const wrap = document.createElement("div");
  wrap.className = "card watch-card";
  let html = '<div class="price-label">⭐ Watching</div>';
  for (const w of watchlist) {
    const award = bestAward(origins, w.dest, w.cabin, { ...opts, nonstop: false });
    const cash = bestCash(origins, w.dest);
    const meta = destByCode(w.dest);
    const milesNow = award?.miles ?? null;
    const cashNow = cash ? Math.round(cash.price) : null;
    const diff = (now, then, unit) => {
      if (now == null || then == null) return "";
      const d = now - then;
      if (!d) return ' <span class="delta-flat">unchanged</span>';
      const cls = d < 0 ? "delta-down" : "delta-up";
      const val = unit === "mi" ? fmtMiles(Math.abs(d)) : "$" + Math.abs(d);
      return ` <span class="${cls}">${d < 0 ? "▼" : "▲"}${val}</span>`;
    };
    html += `<div class="watch-row">
      <strong>${meta?.city || w.dest}</strong> <span class="dest-code">${w.cabin}</span> ·
      saved ${w.miles ? fmtMiles(w.miles) + " mi" : ""}${w.cash ? " / $" + w.cash : ""} (${new Date(w.when).toLocaleDateString()}) →
      now ${milesNow ? fmtMiles(milesNow) + " mi" : "no award space"}${diff(milesNow, w.miles, "mi")}${cashNow ? " / $" + cashNow : ""}${diff(cashNow, w.cash, "$")}
      <button class="del-btn" title="Stop watching" data-unwatch="${w.key}">✕</button>
    </div>`;
  }
  wrap.innerHTML = html;
  wrap.querySelectorAll("[data-unwatch]").forEach((btn) =>
    btn.addEventListener("click", () => {
      watchlist = watchlist.filter((w) => w.key !== btn.dataset.unwatch);
      localStorage.setItem(LS_WATCH, JSON.stringify(watchlist));
      renderBest();
    })
  );
  return wrap;
}

function renderBest() {
  const opts = bestControls();
  const container = $("#best-results");
  container.innerHTML = "";
  if (!DATA.config || (!DATA.cash && !DATA.awards)) return;

  WIN = DATA.config.windows.find((w) => w.id === $("#best-window").value) || DATA.config.windows[0];
  BONUS = $("#bonus-program").value
    ? { program: $("#bonus-program").value, pct: Number($("#bonus-pct").value) || 0 }
    : null;
  localStorage.setItem("awardscout.bonus", JSON.stringify(BONUS));

  const currency = DATA.cash?.currency === "EUR" ? "€" : "$";
  const origins = opts.origin === "any" ? DATA.config.origins : [opts.origin];
  const rows = DATA.config.destinations
    .map((code) => {
      const meta = destByCode(code) || { code, city: code, country: "", region: "Custom", note: "" };
      if (opts.region !== "all" && meta.region !== opts.region) return null;
      const cash = bestCash(origins, code);
      const award = bestAward(origins, code, opts.cabin, opts);
      const delta = bestAward(origins, code, opts.cabin, { ...opts, program: "delta", allPrograms: true });
      const value = cash && award ? ((cash.price - award.taxes) / award.eff) * 100 : null;
      if (!cash && !award) return null;
      return { meta, cash, award, delta, value };
    })
    .filter(Boolean);

  const key = {
    miles: (r) => r.award?.eff ?? Infinity,
    cash: (r) => r.cash?.price ?? Infinity,
    value: (r) => -(r.value ?? -Infinity),
  }[opts.sort];
  rows.sort((a, b) => key(a) - key(b));

  const winLine = document.createElement("p");
  winLine.className = "results-summary";
  winLine.textContent = `${WIN.label}: ${WIN.start} → ${WIN.end}, ${WIN.nights.min}–${WIN.nights.max} nights`;
  container.appendChild(winLine);

  const watching = watchSection(opts, origins);
  if (watching) container.appendChild(watching);

  if (!rows.length) {
    container.innerHTML += '<p class="results-summary">Nothing matches these filters — try relaxing nonstop/seats, or another region.</p>';
    return;
  }

  rows.forEach((r, i) => {
    const card = document.createElement("div");
    card.className = "card best-card";
    const rank = `<span class="rank">#${i + 1}</span>`;
    const watched = watchlist.some((w) => w.key === watchKey(r.meta.code, opts.cabin));
    const head = `<div class="dest-head">${rank}<h3>${r.meta.city}</h3><span class="dest-code">${r.meta.code}${r.meta.country ? " · " + r.meta.country : ""}</span>${trendBadge(r.meta.code, opts.cabin, r.award?.miles ?? null)}${r.value != null ? `<span class="value-badge ${r.value >= 1.2 ? "good" : ""}">${r.value.toFixed(1)}¢/mi</span>` : ""}<button class="watch-btn${watched ? " on" : ""}" title="${watched ? "Stop watching" : "Watch this — compare against future prices"}" data-watch="${r.meta.code}">${watched ? "★" : "☆"}</button></div>`;

    const fam = familyFactor();
    const cashLabel = DATA.cash?.mode === "anchor" ? "Cash benchmark" : "Cheapest cash";
    const cashHtml = r.cash
      ? `<div class="price-block">
           <div class="price-label">${cashLabel}</div>
           <div class="price-big">${currency}${Math.round(r.cash.price).toLocaleString()}</div>
           <div class="price-sub">from ${r.cash.origin} · ${shortDate(r.cash.dep)} → ${shortDate(r.cash.ret)} (${nightsBetween(r.cash.dep, r.cash.ret)}n) · per person</div>
           <div class="price-sub fam-line">👨‍👩‍👧 ≈ ${currency}${Math.round(r.cash.price * fam).toLocaleString()} for ${familyLabel()}</div>
           <a class="link-btn" target="_blank" rel="noopener" href="${gfLink(r.cash.origin, r.meta.code, { dep: r.cash.dep, ret: r.cash.ret }, { nonstop: false, cabin: opts.cabin === "business" ? "business class" : "economy" })}">Verify on Google Flights</a>
         </div>`
      : `<div class="price-block muted-block"><div class="price-label">${cashLabel}</div><div class="price-sub">no data for this route</div></div>`;

    const awardHtml = r.award ? awardBlock("Best with your points", r.award, opts, r.cash?.price) : `<div class="price-block muted-block"><div class="price-label">Best with your points</div><div class="price-sub">no award space found</div></div>`;

    const deltaHtml =
      r.delta && (!r.award || r.delta.miles !== r.award.miles || r.delta.out.program !== r.award.out.program)
        ? awardBlock("Delta SkyMiles specifically", r.delta, opts, r.cash?.price)
        : "";

    card.innerHTML = head + `<p class="dest-note">${r.meta.note}</p><div class="blocks">${cashHtml}${awardHtml}${deltaHtml}</div>`;
    card.querySelector("[data-watch]").addEventListener("click", () => toggleWatch(r.meta.code, opts.cabin, r));

    // Date grid renders lazily on first expand — 21 cards × 2 calendars is
    // too much DOM to build up front.
    if (DATA.awards) {
      const det = document.createElement("details");
      det.className = "date-grid";
      det.innerHTML = `<summary>📅 Every date in this window</summary><div class="grid-slot"></div>`;
      det.addEventListener("toggle", () => {
        if (det.open && !det.dataset.built) {
          det.querySelector(".grid-slot").innerHTML = dateGridHtml(r.meta.code, opts, origins);
          det.dataset.built = "1";
        }
      });
      card.appendChild(det);
    }
    container.appendChild(card);
  });
  syncHash();
}

function familyFactor() {
  const cfg = DATA.config;
  return (cfg.adults ?? 2) + (cfg.lapInfant ? 0.1 : 0);
}
function familyLabel() {
  const cfg = DATA.config;
  return `${cfg.adults} adults${cfg.lapInfant ? " + lap infant" : ""}`;
}

function awardBlock(title, a, opts, cashPrice) {
  const outInfo = programInfo(a.out.program);
  const retInfo = programInfo(a.ret.program);
  const samePro = a.out.program === a.ret.program;
  const programs = samePro ? outInfo.label : `${outInfo.label} out / ${retInfo.label} back`;
  const liveCheck = (leg, label) =>
    `<a class="link-btn" target="_blank" rel="noopener" title="Runs a live seats.aero search for this exact leg — cached prices can be hours old" href="https://seats.aero/search?origin=${leg.origin}&destination=${leg.dest}&date=${leg.date}">⚡ ${label}</a>`;
  const links =
    [...new Set([a.out.program, a.ret.program])]
      .map((p) => {
        const info = programInfo(p);
        return info.url ? `<a class="link-btn" target="_blank" rel="noopener" href="${info.url}">Book ${info.label}</a>` : "";
      })
      .join(" ") +
    liveCheck(a.out, "Live-check out") +
    liveCheck(a.ret, "Live-check back");
  const bonused = Math.round(a.eff) < a.miles;
  const bigMiles = bonused
    ? `${fmtMiles(Math.round(a.eff))} <span class="price-unit">effective</span> <span class="price-taxes">(${fmtMiles(a.miles)} − ${BONUS.pct}% bonus)</span>`
    : `${fmtMiles(a.miles)} <span class="price-unit">miles</span>`;
  const cfg = DATA.config;
  const adults = cfg.adults ?? 2;
  // Lap infant on an international award: ~10% of the adult CASH fare.
  const infantFee = cfg.lapInfant && cashPrice ? Math.round(0.1 * cashPrice) : null;
  const famCash = Math.round(a.taxes * adults + (infantFee ?? 0));
  const famLine = `👨‍👩‍👧 ≈ ${fmtMiles(Math.round(a.eff) * adults)} + $${famCash}${cfg.lapInfant ? (infantFee ? ` (incl. ~$${infantFee} infant fare)` : " + ~10% of cash fare for infant") : ""} for ${familyLabel()}`;
  return `<div class="price-block">
    <div class="price-label">${title}</div>
    <div class="price-big">${bigMiles}${a.taxes ? ` <span class="price-taxes">+ ~$${Math.round(a.taxes)}</span>` : ""}</div>
    <div class="price-sub">${programs}${outInfo.amex && samePro && a.out.program !== "delta" ? " (Amex 1:1)" : ""} · per person</div>
    <div class="price-sub">Out ${shortDate(a.out.date)} from ${a.out.origin} ${fmtMiles(a.out.miles)}${a.out.direct ? " · nonstop" : ""} → Back ${shortDate(a.ret.date)} into ${a.ret.dest} ${fmtMiles(a.ret.miles)}${a.ret.direct ? " · nonstop" : ""}</div>
    <div class="price-sub fam-line">${famLine}</div>
    ${positioningLine(a)}
    ${links}
  </div>`;
}

/* ---------- init ---------- */
async function initBest() {
  [DATA.config, DATA.cash, DATA.awards] = await Promise.all([
    loadJson("data/config.json"),
    loadJson("data/cash.json"),
    loadJson("data/awards.json"),
  ]);
  try {
    const res = await fetch("data/history.ndjson?t=" + Date.now());
    DATA.history = res.ok
      ? (await res.text()).split("\n").filter(Boolean)
          .map((l) => { try { return JSON.parse(l); } catch { return null; } })
          .filter((l) => l && l.windows)
      : [];
  } catch { DATA.history = []; }
  const originSel = $("#best-origin");
  const any = document.createElement("option");
  any.value = "any";
  any.textContent = "Any airport";
  originSel.appendChild(any);
  (DATA.config?.origins || ["JFK"]).forEach((o) => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = o;
    originSel.appendChild(opt);
  });
  const winSel = $("#best-window");
  (DATA.config?.windows || []).forEach((w) => {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = w.label;
    winSel.appendChild(opt);
  });
  // Land on the first window that actually has data rather than an empty view.
  const hasData = (w) =>
    (DATA.awards?.entries || []).some((e) => e.date >= w.start && e.date <= w.end) ||
    (DATA.cash?.entries || []).some((e) => e.dep >= w.start && e.dep <= w.end);
  const firstLive = (DATA.config?.windows || []).find(hasData);
  if (firstLive) winSel.value = firstLive.id;
  if (BONUS) {
    $("#bonus-program").value = BONUS.program;
    $("#bonus-pct").value = BONUS.pct;
  }
  applyHash(); // a shared link overrides the defaults above
  $("#share-view")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(location.href).then(
      () => toast("Link copied — opens this exact view."),
      () => toast(location.href)
    );
  });
  renderBanner();
  renderBest();
  ["#best-window", "#best-origin", "#best-region", "#best-cabin", "#best-sort", "#best-nonstop", "#best-seats", "#best-allprograms", "#bonus-program", "#bonus-pct"].forEach(
    (sel) => $(sel).addEventListener("change", renderBest)
  );
}
initBest();
