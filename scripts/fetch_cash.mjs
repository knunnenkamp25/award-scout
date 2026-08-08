// Fetch cheapest cash round-trip prices from the Amadeus Self-Service
// "Flight Cheapest Date Search" API and write data/cash.json.
// Free developer account: https://developers.amadeus.com
// Set AMADEUS_ENV=production (repo variable) once you move off the test sandbox.
import fs from "node:fs";

const ID = process.env.AMADEUS_CLIENT_ID;
const SECRET = process.env.AMADEUS_CLIENT_SECRET;
if (!ID || !SECRET) {
  console.log("AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET not set — skipping cash fetch.");
  process.exit(0);
}

const BASE =
  process.env.AMADEUS_ENV === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";

const cfg = JSON.parse(fs.readFileSync("data/config.json", "utf8"));

async function getToken() {
  const res = await fetch(BASE + "/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: ID,
      client_secret: SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Amadeus auth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const token = await getToken();

// Latest useful departure still fits a minimum-length trip inside the window.
const latestDep = new Date(cfg.window.end + "T00:00:00Z");
latestDep.setUTCDate(latestDep.getUTCDate() - cfg.nights.min);
const depRange = `${cfg.window.start},${latestDep.toISOString().slice(0, 10)}`;

const entries = [];
let currency = "USD";
for (const origin of cfg.origins) {
  for (const dest of cfg.destinations) {
    const p = new URLSearchParams({
      origin,
      destination: dest,
      departureDate: depRange,
      oneWay: "false",
      duration: `${cfg.nights.min},${cfg.nights.max}`,
      nonStop: "false",
      viewBy: "DATE",
    });
    const res = await fetch(BASE + "/v1/shopping/flight-dates?" + p, {
      headers: { Authorization: "Bearer " + token },
    });
    if (res.status === 404) {
      // Route not in Amadeus's cache (common in the test sandbox) — skip it.
      console.log(`no cash data for ${origin}-${dest}`);
      await sleep(120);
      continue;
    }
    if (!res.ok) {
      console.log(`Amadeus ${res.status} for ${origin}-${dest}: ${await res.text()}`);
      await sleep(120);
      continue;
    }
    const json = await res.json();
    currency = json?.meta?.currency || currency;
    for (const d of json.data || []) {
      entries.push({
        origin,
        dest,
        dep: d.departureDate,
        ret: d.returnDate,
        price: Number(d.price?.total),
      });
    }
    await sleep(120); // stay under sandbox rate limits
  }
}

fs.writeFileSync(
  "data/cash.json",
  JSON.stringify({ generated: new Date().toISOString(), sample: false, currency, entries })
);
console.log(`Wrote data/cash.json with ${entries.length} entries (${currency}).`);
