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
// `origins` is a list: pass all home airports for "Any airport" mode.
function bestCash(origins, dest) {
  if (!DATA.cash) return null;
  const { min, max } = DATA.config.nights;
  let best = null;
  for (const e of DATA.cash.entries) {
    if (!origins.includes(e.origin) || e.dest !== dest || !e.price) continue;
    const n = nightsBetween(e.dep, e.ret);
    if (n < min || n > max) continue;
    if (!best || e.price < best.price) best = e;
  }
  return best;
}

function awardLegs(origins, dest, direction, cabin, opts) {
  return DATA.awards.entries.filter((e) => {
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
// nights range. One-way awards book independently, so programs may differ —
// and in "Any airport" mode the return may land at a different home airport.
function bestAward(origins, dest, cabin, opts) {
  if (!DATA.awards) return null;
  const { min, max } = DATA.config.nights;
  const outs = awardLegs(origins, dest, "out", cabin, opts);
  const rets = awardLegs(origins, dest, "ret", cabin, opts);
  let best = null;
  for (const o of outs) {
    for (const r of rets) {
      const n = nightsBetween(o.date, r.date);
      if (n < min || n > max) continue;
      const miles = o.miles + r.miles;
      if (!best || miles < best.miles) {
        best = { miles, taxes: (o.taxes ?? 0) + (r.taxes ?? 0), out: o, ret: r };
      }
    }
  }
  return best;
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
      '<div class="banner warn"><strong>⚠️ Sample data</strong> — these are made-up numbers so you can try the interface. Add your seats.aero and Amadeus API keys as repo secrets and run the "Refresh price data" action to get real prices.</div>';
  } else {
    const when = new Date(DATA.awards?.generated || DATA.cash?.generated);
    const hrs = Math.round((Date.now() - when) / 3600000);
    el.innerHTML = `<div class="banner ok">Prices refreshed ${hrs <= 1 ? "within the last hour" : hrs + " hours ago"} · window ${DATA.config.window.start} → ${DATA.config.window.end}</div>`;
  }
}

function renderBest() {
  const opts = bestControls();
  const container = $("#best-results");
  container.innerHTML = "";
  if (!DATA.config || (!DATA.cash && !DATA.awards)) return;

  const currency = DATA.cash?.currency === "EUR" ? "€" : "$";
  const origins = opts.origin === "any" ? DATA.config.origins : [opts.origin];
  const rows = DATA.config.destinations
    .map((code) => {
      const meta = destByCode(code) || { code, city: code, country: "", region: "Custom", note: "" };
      if (opts.region !== "all" && meta.region !== opts.region) return null;
      const cash = bestCash(origins, code);
      const award = bestAward(origins, code, opts.cabin, opts);
      const delta = bestAward(origins, code, opts.cabin, { ...opts, program: "delta", allPrograms: true });
      const value = cash && award ? ((cash.price - award.taxes) / award.miles) * 100 : null;
      if (!cash && !award) return null;
      return { meta, cash, award, delta, value };
    })
    .filter(Boolean);

  const key = {
    miles: (r) => r.award?.miles ?? Infinity,
    cash: (r) => r.cash?.price ?? Infinity,
    value: (r) => -(r.value ?? -Infinity),
  }[opts.sort];
  rows.sort((a, b) => key(a) - key(b));

  if (!rows.length) {
    container.innerHTML = '<p class="results-summary">Nothing matches these filters — try relaxing nonstop/seats, or another region.</p>';
    return;
  }

  rows.forEach((r, i) => {
    const card = document.createElement("div");
    card.className = "card best-card";
    const rank = `<span class="rank">#${i + 1}</span>`;
    const head = `<div class="dest-head">${rank}<h3>${r.meta.city}</h3><span class="dest-code">${r.meta.code}${r.meta.country ? " · " + r.meta.country : ""}</span>${r.value != null ? `<span class="value-badge ${r.value >= 1.2 ? "good" : ""}">${r.value.toFixed(1)}¢/mi</span>` : ""}</div>`;

    const cashLabel = DATA.cash?.mode === "anchor" ? "Cash benchmark" : "Cheapest cash";
    const cashHtml = r.cash
      ? `<div class="price-block">
           <div class="price-label">${cashLabel}</div>
           <div class="price-big">${currency}${Math.round(r.cash.price).toLocaleString()}</div>
           <div class="price-sub">from ${r.cash.origin} · ${shortDate(r.cash.dep)} → ${shortDate(r.cash.ret)} (${nightsBetween(r.cash.dep, r.cash.ret)}n) · per person</div>
           <a class="link-btn" target="_blank" rel="noopener" href="${gfLink(r.cash.origin, r.meta.code, { dep: r.cash.dep, ret: r.cash.ret }, { nonstop: false, cabin: opts.cabin === "business" ? "business class" : "economy" })}">Verify on Google Flights</a>
         </div>`
      : `<div class="price-block muted-block"><div class="price-label">${cashLabel}</div><div class="price-sub">no data for this route</div></div>`;

    const awardHtml = r.award ? awardBlock("Best with your points", r.award, opts) : `<div class="price-block muted-block"><div class="price-label">Best with your points</div><div class="price-sub">no award space found</div></div>`;

    const deltaHtml =
      r.delta && (!r.award || r.delta.miles !== r.award.miles || r.delta.out.program !== r.award.out.program)
        ? awardBlock("Delta SkyMiles specifically", r.delta, opts)
        : "";

    card.innerHTML = head + `<p class="dest-note">${r.meta.note}</p><div class="blocks">${cashHtml}${awardHtml}${deltaHtml}</div>`;
    container.appendChild(card);
  });
}

function awardBlock(title, a, opts) {
  const outInfo = programInfo(a.out.program);
  const retInfo = programInfo(a.ret.program);
  const samePro = a.out.program === a.ret.program;
  const programs = samePro ? outInfo.label : `${outInfo.label} out / ${retInfo.label} back`;
  const links = [...new Set([a.out.program, a.ret.program])]
    .map((p) => {
      const info = programInfo(p);
      return info.url ? `<a class="link-btn" target="_blank" rel="noopener" href="${info.url}">Book ${info.label}</a>` : "";
    })
    .join(" ");
  return `<div class="price-block">
    <div class="price-label">${title}</div>
    <div class="price-big">${fmtMiles(a.miles)} <span class="price-unit">miles</span>${a.taxes ? ` <span class="price-taxes">+ ~$${Math.round(a.taxes)}</span>` : ""}</div>
    <div class="price-sub">${programs}${outInfo.amex && samePro && a.out.program !== "delta" ? " (Amex 1:1)" : ""} · per person</div>
    <div class="price-sub">Out ${shortDate(a.out.date)} from ${a.out.origin} ${fmtMiles(a.out.miles)}${a.out.direct ? " · nonstop" : ""} → Back ${shortDate(a.ret.date)} into ${a.ret.dest} ${fmtMiles(a.ret.miles)}${a.ret.direct ? " · nonstop" : ""}</div>
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
  renderBanner();
  renderBest();
  ["#best-origin", "#best-region", "#best-cabin", "#best-sort", "#best-nonstop", "#best-seats", "#best-allprograms"].forEach(
    (sel) => $(sel).addEventListener("change", renderBest)
  );
}
initBest();
