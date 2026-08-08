// Fetch award availability from the seats.aero Partner API (Pro subscription)
// and write data/awards.json. Skips gracefully when the key isn't configured
// so the workflow still succeeds with only one feed set up.
import fs from "node:fs";

const KEY = process.env.SEATS_AERO_API_KEY;
if (!KEY) {
  console.log("SEATS_AERO_API_KEY not set — skipping award fetch.");
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync("data/config.json", "utf8"));
const HEADERS = { "Partner-Authorization": KEY, Accept: "application/json" };
const CABIN_BY_LETTER = { Y: "economy", W: "premium", J: "business", F: "first" };

async function search(origins, destinations) {
  const results = [];
  let cursor;
  do {
    const p = new URLSearchParams({
      origin_airport: origins.join(","),
      destination_airport: destinations.join(","),
      start_date: cfg.window.start,
      end_date: cfg.window.end,
      take: "1000",
    });
    if (cursor) p.set("cursor", cursor);
    const res = await fetch("https://seats.aero/partnerapi/search?" + p, { headers: HEADERS });
    if (!res.ok) throw new Error(`seats.aero ${res.status}: ${await res.text()}`);
    const json = await res.json();
    results.push(...(json.data || []));
    cursor = json.hasMore ? json.cursor : null;
  } while (cursor);
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

const outbound = await search(cfg.origins, cfg.destinations);
const inbound = await search(cfg.destinations, cfg.origins);
const entries = toEntries(outbound).concat(toEntries(inbound));

fs.writeFileSync(
  "data/awards.json",
  JSON.stringify({ generated: new Date().toISOString(), sample: false, entries })
);
console.log(`Wrote data/awards.json with ${entries.length} entries.`);
