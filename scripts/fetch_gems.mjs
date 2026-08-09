// Weekly discovery sweep: pull seats.aero's BULK availability (everything a
// program has from North America in our travel windows) and surface cheap
// awards to destinations we are NOT tracking — the "hidden gems" list.
// Runs weekly with its own request budget so it never competes with the
// twice-daily refresh for the 1,000-call quota.
import fs from "node:fs";

const KEY = process.env.SEATS_AERO_API_KEY;
if (!KEY) {
  console.log("SEATS_AERO_API_KEY not set — skipping gems sweep.");
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync("data/config.json", "utf8"));
const HEADERS = { "Partner-Authorization": KEY, Accept: "application/json" };
const MAX_REQUESTS = 220;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Priority order: the programs this household can actually use.
const SOURCES = ["flyingblue", "delta", "virginatlantic", "aeroplan", "british"];
// One-way "worth a look" ceilings per cabin.
const CEILING = { Y: 35000, W: 65000, J: 90000 };
const CABIN_NAME = { Y: "economy", W: "premium", J: "business" };

const ORIGINS = new Set(cfg.origins);
const KNOWN = new Set(cfg.destinations);

let requestCount = 0;
let rateLimited = false;
const best = {}; // dest|cabin -> {entry, days:Set}

async function sweep(source, window) {
  let skip = 0;
  let cursor = null;
  for (let page = 0; page < 40; page++) {
    if (requestCount >= MAX_REQUESTS || rateLimited) return;
    const p = new URLSearchParams({
      source,
      origin_region: "North America",
      start_date: window.start,
      end_date: window.end,
      take: "1000",
    });
    if (skip > 0) {
      p.set("skip", String(skip));
      if (cursor != null) p.set("cursor", String(cursor));
    }
    requestCount++;
    const res = await fetch("https://seats.aero/partnerapi/availability?" + p, { headers: HEADERS });
    if (res.status === 429) {
      console.log(`Rate limited after ${requestCount} calls — keeping what we have.`);
      rateLimited = true;
      return;
    }
    if (!res.ok) {
      console.log(`${source}/${window.id}: HTTP ${res.status} — skipping source`);
      return;
    }
    const json = await res.json();
    const batch = json.data || [];
    for (const item of batch) {
      const route = item.Route || {};
      const origin = route.OriginAirport;
      const dest = route.DestinationAirport;
      if (!ORIGINS.has(origin) || KNOWN.has(dest) || !dest) continue;
      for (const [letter, ceiling] of Object.entries(CEILING)) {
        if (!item[letter + "Available"]) continue;
        const miles = Number(item[letter + "MileageCost"]);
        if (!miles || miles < 1500 || miles > ceiling) continue;
        const key = dest + "|" + letter;
        const cur = best[key];
        if (!cur) {
          best[key] = {
            entry: { dest, cabin: CABIN_NAME[letter], miles, date: item.Date, program: source, origin,
                     direct: !!item[letter + "Direct"], seats: Number(item[letter + "RemainingSeats"]) || 0 },
            days: new Set([item.Date]),
          };
        } else {
          cur.days.add(item.Date);
          if (miles < cur.entry.miles) {
            cur.entry = { dest, cabin: CABIN_NAME[letter], miles, date: item.Date, program: source, origin,
                          direct: !!item[letter + "Direct"], seats: Number(item[letter + "RemainingSeats"]) || 0 };
          }
        }
      }
    }
    if (cursor == null && json.cursor != null) cursor = json.cursor;
    console.log(`${source}/${window.id}: page ${page + 1}, +${batch.length} rows, hasMore=${!!json.hasMore}`);
    if (!json.hasMore || batch.length === 0) return;
    skip += batch.length;
    await sleep(600);
  }
}

for (const source of SOURCES) {
  for (const window of cfg.windows) {
    if (requestCount >= MAX_REQUESTS || rateLimited) break;
    await sweep(source, window);
  }
}

const entries = Object.values(best)
  .map(({ entry, days }) => ({ ...entry, days: days.size }))
  .sort((a, b) => a.miles - b.miles)
  .slice(0, 100);

fs.writeFileSync(
  "data/gems.json",
  JSON.stringify({ generated: new Date().toISOString(), entries })
);
console.log(`Wrote data/gems.json: ${entries.length} gems from ${requestCount} API calls.`);
