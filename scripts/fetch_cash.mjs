// Fetch benchmark cash prices via SerpAPI's Google Flights engine and write
// data/cash.json. One call per origin-destination pair on an anchor date in
// the middle of the window, so the free plan (100 searches/month) easily
// covers a twice-monthly refresh. (Amadeus Self-Service, the previous source,
// was decommissioned in July 2026.)
import fs from "node:fs";

const KEY = process.env.SERPAPI_KEY;
if (!KEY) {
  console.log("SERPAPI_KEY not set — skipping cash fetch.");
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync("data/config.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Anchor trip: centered in the window, median length.
const start = new Date(cfg.window.start + "T00:00:00Z");
const end = new Date(cfg.window.end + "T00:00:00Z");
const nights = Math.round((cfg.nights.min + cfg.nights.max) / 2);
const mid = new Date((start.getTime() + end.getTime()) / 2);
const dep = new Date(mid);
dep.setUTCDate(dep.getUTCDate() - Math.ceil(nights / 2));
const ret = new Date(dep);
ret.setUTCDate(ret.getUTCDate() + nights);
const iso = (d) => d.toISOString().slice(0, 10);

function lowestPrice(json) {
  if (json.price_insights?.lowest_price) return json.price_insights.lowest_price;
  const all = [...(json.best_flights || []), ...(json.other_flights || [])]
    .map((f) => f.price)
    .filter(Boolean);
  return all.length ? Math.min(...all) : null;
}

const entries = [];
for (const origin of cfg.origins) {
  for (const dest of cfg.destinations) {
    const p = new URLSearchParams({
      engine: "google_flights",
      departure_id: origin,
      arrival_id: dest,
      outbound_date: iso(dep),
      return_date: iso(ret),
      currency: "USD",
      adults: String(cfg.adults || 2),
      hl: "en",
      api_key: KEY,
    });
    try {
      const res = await fetch("https://serpapi.com/search.json?" + p);
      if (!res.ok) {
        console.log(`SerpAPI ${res.status} for ${origin}-${dest}: ${await res.text()}`);
        continue;
      }
      const json = await res.json();
      const price = lowestPrice(json);
      if (price) {
        // Round-trip total is per person; store per-person like awards.
        entries.push({ origin, dest, dep: iso(dep), ret: iso(ret), price });
        console.log(`${origin}-${dest}: $${price}`);
      } else {
        console.log(`${origin}-${dest}: no price returned`);
      }
    } catch (err) {
      console.log(`fetch failed for ${origin}-${dest}: ${err.message}`);
    }
    await sleep(1100);
  }
}

fs.writeFileSync(
  "data/cash.json",
  JSON.stringify({
    generated: new Date().toISOString(),
    sample: false,
    mode: "anchor",
    currency: "USD",
    entries,
  })
);
console.log(`Wrote data/cash.json with ${entries.length} entries.`);
