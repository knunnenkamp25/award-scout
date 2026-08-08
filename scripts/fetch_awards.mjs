// Fetch award availability from the seats.aero Partner API (Pro subscription)
// and write data/awards.json. Skips gracefully when the key isn't configured
// so the workflow still succeeds with only one feed set up.
//
// Pagination per seats.aero docs: pass `skip` = number of results already
// retrieved, plus `cursor` = the cursor from the FIRST response (a timestamp
// that pins consistent ordering). The daily quota is 1,000 calls, so the
// whole run is also capped by a request budget and any rate-limit response
// ends the run gracefully with whatever was collected.
import fs from "node:fs";

const KEY = process.env.SEATS_AERO_API_KEY;
if (!KEY) {
  console.log("SEATS_AERO_API_KEY not set — skipping award fetch.");
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync("data/config.json", "utf8"));
const HEADERS = { "Partner-Authorization": KEY, Accept: "application/json" };
const CABIN_BY_LETTER = { Y: "economy", W: "premium", J: "business", F: "first" };
const MAX_REQUESTS = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let requestCount = 0;
let rateLimited = false;

async function search(origins, destinations, label) {
  const results = [];
  let skip = 0;
  let cursor = null;
  for (let page = 0; page < 40; page++) {
    if (requestCount >= MAX_REQUESTS || rateLimited) break;
    const p = new URLSearchParams({
      origin_airport: origins.join(","),
      destination_airport: destinations.join(","),
      start_date: cfg.window.start,
      end_date: cfg.window.end,
      cabins: cfg.cabins.join(","),
      take: "1000",
    });
    if (skip > 0) {
      p.set("skip", String(skip));
      if (cursor != null) p.set("cursor", String(cursor));
    }
    requestCount++;
    const res = await fetch("https://seats.aero/partnerapi/search?" + p, { headers: HEADERS });
    if (res.status === 429) {
      console.log(`Rate limited after ${requestCount} calls — keeping what we have.`);
      rateLimited = true;
      break;
    }
    if (!res.ok) throw new Error(`seats.aero ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const batch = json.data || [];
    results.push(...batch);
    if (cursor == null && json.cursor != null) cursor = json.cursor;
    console.log(`${label}: page ${page + 1}, +${batch.length} rows (total ${results.length}), hasMore=${!!json.hasMore}`);
    if (!json.hasMore || batch.length === 0) break;
    skip += batch.length;
    await sleep(600);
  }
  return results;
}

function toEntries(items) {
  const entries = [];
  for (const item of items) {
    const route = item.Route || {};
    for (const [letter, cabin] of Object.entries(CABIN_BY_LETTER)) {
      if (!item[letter + "Available"]) continue;
      const miles = Number(item[letter + "MileageCost"]);
      if (!miles) continue;
      const taxesRaw = item[letter + "TotalTaxes"];
      entries.push({
        origin: route.OriginAirport,
        dest: route.DestinationAirport,
        date: item.Date,
        program: route.Source,
        cabin,
        miles,
        // TotalTaxes is in minor units (cents) of TaxesCurrency when present
        taxes: taxesRaw != null ? Number(taxesRaw) / 100 : null,
        taxesCurrency: item.TaxesCurrency || null,
        direct: !!item[letter + "Direct"],
        seats: Number(item[letter + "RemainingSeats"]) || 0,
        airlines: item[letter + "Airlines"] || "",
      });
    }
  }
  return entries;
}

const outbound = await search(cfg.origins, cfg.destinations, "outbound");
const inbound = await search(cfg.destinations, cfg.origins, "inbound");
const entries = toEntries(outbound).concat(toEntries(inbound));

if (entries.length === 0) {
  // Never overwrite good data with an empty fetch (e.g. a fully
  // rate-limited run) — fail loudly instead so the workflow shows red.
  console.error("No award entries fetched — leaving existing data/awards.json untouched.");
  process.exit(1);
}

fs.writeFileSync(
  "data/awards.json",
  JSON.stringify({ generated: new Date().toISOString(), sample: false, entries })
);
console.log(`Wrote data/awards.json with ${entries.length} entries from ${requestCount} API calls.`);
