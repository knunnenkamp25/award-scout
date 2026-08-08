/* Award Scout — static search fan-out generator.
   All state lives in localStorage; nothing leaves the browser. */

const LS_CONFIG = "awardscout.config";
const LS_LOG = "awardscout.log";
const LS_CUSTOM = "awardscout.customDests";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ---------- tabs ---------- */
$$(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    $$(".tab-panel").forEach((p) =>
      p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab)
    );
  });
});

/* ---------- destination state ---------- */
let customDests = JSON.parse(localStorage.getItem(LS_CUSTOM) || "[]");
let selected = new Set();
let activeRegion = "Europe";

function allDests() {
  return DESTINATIONS.concat(customDests);
}
function destByCode(code) {
  return allDests().find((d) => d.code === code);
}

function renderRegions() {
  const row = $("#region-buttons");
  row.innerHTML = "";
  REGIONS.forEach((r) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "region-btn" + (r === activeRegion ? " active" : "");
    b.textContent = r;
    b.addEventListener("click", () => {
      activeRegion = r;
      renderRegions();
      renderChips();
    });
    row.appendChild(b);
  });
}

function renderChips() {
  const grid = $("#dest-chips");
  grid.innerHTML = "";
  const inRegion = DESTINATIONS.filter((d) => d.region === activeRegion);
  const customs = customDests; // customs always shown
  inRegion.concat(customs).forEach((d) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (selected.has(d.code) ? " selected" : "");
    chip.textContent = `${d.city} ${d.code}`;
    chip.addEventListener("click", () => {
      selected.has(d.code) ? selected.delete(d.code) : selected.add(d.code);
      chip.classList.toggle("selected");
      saveConfig();
    });
    grid.appendChild(chip);
  });
}

$("#add-dest-btn").addEventListener("click", () => {
  const input = $("#custom-dest");
  const code = input.value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return;
  if (!destByCode(code)) {
    customDests.push({ code, city: code, country: "", region: "Custom", note: "Custom destination." });
    localStorage.setItem(LS_CUSTOM, JSON.stringify(customDests));
  }
  selected.add(code);
  input.value = "";
  renderChips();
  saveConfig();
});

/* ---------- config persistence ---------- */
function saveConfig() {
  const cfg = {
    origins: $("#origins").value,
    around: $("#around-date").value,
    flex: $("#flex-days").value,
    minN: $("#min-nights").value,
    maxN: $("#max-nights").value,
    adults: $("#adults").value,
    infant: $("#infant").checked,
    cabin: $("#cabin").value,
    nonstop: $("#nonstop").checked,
    selected: [...selected],
  };
  localStorage.setItem(LS_CONFIG, JSON.stringify(cfg));
}

function loadConfig() {
  const raw = localStorage.getItem(LS_CONFIG);
  if (!raw) {
    selected = new Set(DEFAULT_SELECTED);
    // default target: around Dec 20 of the current (or next) year
    const now = new Date();
    const year = now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();
    $("#around-date").value = `${year}-12-20`;
    return;
  }
  try {
    const cfg = JSON.parse(raw);
    $("#origins").value = cfg.origins || "";
    $("#around-date").value = cfg.around || "";
    $("#flex-days").value = cfg.flex ?? "7";
    $("#min-nights").value = cfg.minN ?? 6;
    $("#max-nights").value = cfg.maxN ?? 9;
    $("#adults").value = cfg.adults ?? 2;
    $("#infant").checked = cfg.infant ?? true;
    $("#cabin").value = cfg.cabin || "economy";
    $("#nonstop").checked = !!cfg.nonstop;
    selected = new Set(cfg.selected || DEFAULT_SELECTED);
  } catch {
    selected = new Set(DEFAULT_SELECTED);
  }
}

/* ---------- date math ---------- */
function fmt(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function prettyDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

// All departure/return pairs inside the window.
function datePairs(aroundIso, flex, minN, maxN) {
  const around = new Date(aroundIso + "T00:00:00Z");
  const pairs = [];
  for (let off = -flex; off <= flex; off++) {
    const dep = addDays(around, off);
    if (dep < addDays(new Date(), 1)) continue; // no past departures
    for (let n = minN; n <= maxN; n++) {
      pairs.push({ dep: fmt(dep), ret: fmt(addDays(dep, n)), nights: n });
    }
  }
  return pairs;
}

// The single "anchor" pair used for the big one-click links:
// depart on the around-date, stay the median length.
function anchorPair(aroundIso, flex, minN, maxN) {
  const all = datePairs(aroundIso, flex, minN, maxN);
  if (!all.length) return null;
  const midNights = Math.round((Number(minN) + Number(maxN)) / 2);
  return (
    all.find((p) => p.dep === aroundIso && p.nights === midNights) ||
    all[Math.floor(all.length / 2)]
  );
}

/* ---------- link builders ---------- */
function gfLink(origin, dest, pair, opts) {
  let q = `Flights from ${origin} to ${dest} on ${pair.dep} through ${pair.ret}`;
  if (opts.nonstop) q += " nonstop";
  if (opts.cabin !== "economy") q += " " + opts.cabin;
  return "https://www.google.com/travel/flights?q=" + encodeURIComponent(q);
}

// Delta doesn't accept prefilled search URLs (verified: their old deep-link
// format now errors out). Instead: copy the trip details, open their form,
// and let the user paste/type them in — with a toast confirming the copy.
function deltaButton(origin, dest, pair, opts) {
  const a = document.createElement("a");
  a.href = "https://www.delta.com/flight-search/book-a-flight";
  a.target = "_blank";
  a.rel = "noopener";
  a.className = "link-btn";
  a.textContent = "Delta (miles) ⧉";
  a.title = "Opens Delta's search and copies your trip details — check 'Shop with Miles'";
  a.addEventListener("click", () => {
    const txt = `${origin} → ${dest} · depart ${pair.dep} · return ${pair.ret} · ${opts.adults} adults — check "Shop with Miles"`;
    navigator.clipboard?.writeText(txt).then(
      () => toast(`Copied: ${origin} → ${dest}, ${prettyDate(pair.dep)}–${prettyDate(pair.ret)}. Check "Shop with Miles" on Delta.`),
      () => {}
    );
  });
  return a;
}

let toastTimer;
function toast(msg) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 4000);
}

const PROGRAM_LINKS = [
  { label: "Flying Blue", url: "https://wwws.airfrance.us/", tip: "Search 'Book with Miles' — Amex transfers 1:1" },
  { label: "Virgin Atlantic", url: "https://www.virginatlantic.com/us/en/book/flights", tip: "Books Delta flights, often cheaper — Amex 1:1" },
  { label: "seats.aero", url: "https://seats.aero/search", tip: "Free award-space scanner across programs" },
];

/* ---------- results rendering ---------- */
$("#search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  saveConfig();
  renderResults();
});

function renderResults() {
  const origins = $("#origins")
    .value.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{3}$/.test(s));
  const opts = {
    cabin: $("#cabin").value,
    nonstop: $("#nonstop").checked,
    adults: Number($("#adults").value),
    infant: $("#infant").checked,
  };
  const aroundIso = $("#around-date").value;
  const flex = Number($("#flex-days").value);
  const minN = Number($("#min-nights").value);
  const maxN = Number($("#max-nights").value);
  const anchor = anchorPair(aroundIso, flex, minN, maxN);
  const results = $("#results");
  results.innerHTML = "";

  if (!origins.length || !anchor || !selected.size) {
    results.innerHTML =
      '<p class="results-summary">Add at least one origin, a date, and a destination.</p>';
    return;
  }

  const pairs = datePairs(aroundIso, flex, minN, maxN);
  const summary = document.createElement("p");
  summary.className = "results-summary";
  summary.innerHTML =
    `<strong>${selected.size}</strong> destinations × <strong>${origins.length}</strong> origin(s), ` +
    `${pairs.length} possible date pairs (${prettyDate(pairs[0].dep)}–${prettyDate(pairs.at(-1).dep)} departures, ${minN}–${maxN} nights). ` +
    `Open Google Flights and use its <em>price-graph</em> to sweep the dates in one view` +
    (opts.infant ? `. Lap infant: add in each site after opening — see Cheat Sheet for award-ticket infant rules.` : `.`);
  results.appendChild(summary);

  [...selected].map(destByCode).filter(Boolean).forEach((dest) => {
    const card = document.createElement("div");
    card.className = "card dest-card";

    const head = document.createElement("div");
    head.className = "dest-head";
    head.innerHTML = `<h3>${dest.city}</h3><span class="dest-code">${dest.code}${dest.country ? " · " + dest.country : ""}</span>`;
    card.appendChild(head);

    const note = document.createElement("p");
    note.className = "dest-note";
    note.textContent = dest.note;
    card.appendChild(note);

    origins.forEach((origin) => {
      const row = document.createElement("div");
      row.className = "link-row";
      if (origins.length > 1) {
        const tag = document.createElement("span");
        tag.className = "dest-code";
        tag.style.alignSelf = "center";
        tag.textContent = origin + " →";
        row.appendChild(tag);
      }
      row.appendChild(linkBtn(gfLink(origin, dest.code, anchor, opts), "Google Flights (cash)", true));
      row.appendChild(deltaButton(origin, dest.code, anchor, opts));
      PROGRAM_LINKS.forEach((pl) => row.appendChild(linkBtn(pl.url, pl.label, false, pl.tip)));
      card.appendChild(row);

      // expandable full fan-out of every date pair on Google Flights
      const det = document.createElement("details");
      det.className = "date-pairs";
      const sum = document.createElement("summary");
      sum.textContent = `All ${pairs.length} date pairs on Google Flights (${origin})`;
      det.appendChild(sum);
      const list = document.createElement("div");
      list.className = "date-pair-list";
      pairs.forEach((p) => {
        const a = document.createElement("a");
        a.href = gfLink(origin, dest.code, p, opts);
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = `${prettyDate(p.dep)}–${prettyDate(p.ret)} (${p.nights}n)`;
        list.appendChild(a);
      });
      det.appendChild(list);
      card.appendChild(det);
    });

    const logBtn = document.createElement("button");
    logBtn.className = "btn btn-ghost log-this";
    logBtn.textContent = "＋ Log a find for " + dest.city;
    logBtn.addEventListener("click", () => {
      $("#log-route").value = `${origins[0]}→${dest.code}`;
      $("#log-dates").value = `${prettyDate(anchor.dep)}–${prettyDate(anchor.ret)}`;
      $$(".tab").find((t) => t.dataset.tab === "log").click();
      $("#log-cash").focus();
    });
    card.appendChild(logBtn);

    results.appendChild(card);
  });
}

function linkBtn(href, label, primary = false, tip = "") {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  a.className = "link-btn" + (primary ? " primary" : "");
  a.textContent = label;
  if (tip) a.title = tip;
  return a;
}

/* ---------- trip log ---------- */
let log = JSON.parse(localStorage.getItem(LS_LOG) || "[]");

function saveLog() {
  localStorage.setItem(LS_LOG, JSON.stringify(log));
}

function centsPerMile(entry) {
  const cash = Number(entry.cash), miles = Number(entry.miles), taxes = Number(entry.taxes || 0);
  if (!cash || !miles) return null;
  return ((cash - taxes) / miles) * 100;
}

function renderLog() {
  const tbody = $("#log-table tbody");
  tbody.innerHTML = "";
  log.forEach((entry, i) => {
    const tr = document.createElement("tr");
    const cpm = centsPerMile(entry);
    const cpmCell = cpm === null ? "—" : cpm.toFixed(2) + "¢";
    const cpmClass = cpm === null ? "" : cpm >= 1.2 ? "cpm-good" : "cpm-bad";
    tr.innerHTML =
      `<td>${esc(entry.route)}</td><td>${esc(entry.dates)}</td>` +
      `<td>${entry.cash ? "$" + entry.cash : "—"}</td>` +
      `<td>${entry.miles ? Number(entry.miles).toLocaleString() : "—"}</td>` +
      `<td>${entry.taxes ? "$" + entry.taxes : "—"}</td>` +
      `<td class="${cpmClass}">${cpmCell}</td>` +
      `<td>${esc(entry.program)}</td><td>${esc(entry.notes || "")}</td>`;
    const tdDel = document.createElement("td");
    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "✕";
    del.title = "Delete row";
    del.addEventListener("click", () => {
      log.splice(i, 1);
      saveLog();
      renderLog();
    });
    tdDel.appendChild(del);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s ?? "";
  return div.innerHTML;
}

$("#log-form").addEventListener("submit", (e) => {
  e.preventDefault();
  log.push({
    route: $("#log-route").value,
    dates: $("#log-dates").value,
    cash: $("#log-cash").value,
    miles: $("#log-miles").value,
    taxes: $("#log-taxes").value,
    program: $("#log-program").value,
    notes: $("#log-notes").value,
    added: new Date().toISOString(),
  });
  saveLog();
  renderLog();
  e.target.reset();
});

$("#export-csv").addEventListener("click", () => {
  const header = ["route", "dates", "cash", "miles", "taxes", "cents_per_mile", "program", "notes", "added"];
  const rows = log.map((e) => {
    const cpm = centsPerMile(e);
    return [e.route, e.dates, e.cash, e.miles, e.taxes, cpm === null ? "" : cpm.toFixed(2), e.program, e.notes, e.added]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",");
  });
  const blob = new Blob([header.join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "award-scout-log.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#clear-log").addEventListener("click", () => {
  if (confirm("Delete all logged finds?")) {
    log = [];
    saveLog();
    renderLog();
  }
});

/* ---------- init ---------- */
loadConfig();
renderRegions();
renderChips();
renderLog();
$("#search-form").addEventListener("change", saveConfig);
