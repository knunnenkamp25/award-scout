// Generate clearly-labeled SAMPLE data so the Best Options UI works before
// API keys are configured. Deterministic (seeded) so reruns are stable.
// Run: node scripts/make_sample_data.mjs
import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync("data/config.json", "utf8"));

// mulberry32 seeded PRNG
let s = 42;
function rnd() {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// rough long-haul vs short-haul base pricing per destination
const LONG_HAUL = new Set(["HNL", "GRU", "EZE", "NRT"]);
const CARIB = new Set(["SJU", "CUN", "AUA", "SXM", "MBJ"]);
function basePrice(dest) {
  if (CARIB.has(dest)) return 380;
  if (LONG_HAUL.has(dest)) return 1150;
  return 640; // Europe
}

// Sample data covers the first configured window only — enough to demo the UI.
const win = cfg.windows[0];
const days = [];
{
  const d = new Date(win.start + "T00:00:00Z");
  const end = new Date(win.end + "T00:00:00Z");
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
}
// Holiday-peak multiplier: expensive Dec 18–23 departures, cheap Dec 24–26 & Jan 1+
function peak(date) {
  const md = date.slice(5);
  if (md >= "12-18" && md <= "12-23") return 1.45;
  if (md >= "12-24" && md <= "12-26") return 0.8;
  if (md >= "01-01") return 0.75;
  return 1.0;
}

const cash = [];
for (const origin of cfg.origins) {
  for (const dest of cfg.destinations) {
    for (const dep of days) {
      for (let n = win.nights.min; n <= win.nights.max; n++) {
        const retD = new Date(dep + "T00:00:00Z");
        retD.setUTCDate(retD.getUTCDate() + n);
        const ret = retD.toISOString().slice(0, 10);
        if (ret > win.end) continue;
        if (rnd() < 0.45) continue; // sparse, like real cached data
        const price = Math.round(basePrice(dest) * peak(dep) * (0.85 + rnd() * 0.5));
        cash.push({ origin, dest, dep, ret, price });
      }
    }
  }
}

const PROGRAMS = ["delta", "flyingblue", "virginatlantic", "aeroplan", "british"];
const AIRLINES = { delta: "DL", flyingblue: "AF, KL", virginatlantic: "VS, DL", aeroplan: "AC, LH, TP", british: "BA, EI, IB" };
function baseMiles(dest, cabin) {
  const eco = CARIB.has(dest) ? 17000 : LONG_HAUL.has(dest) ? 40000 : 26000;
  return cabin === "business" ? eco * 2.6 : eco;
}

const awards = [];
for (const origin of cfg.origins) {
  for (const dest of cfg.destinations) {
    for (const [a, b] of [[origin, dest], [dest, origin]]) {
      for (const date of days) {
        for (const program of PROGRAMS) {
          for (const cabin of ["economy", "business"]) {
            if (rnd() < 0.72) continue; // award space is scarce
            const miles = Math.round((baseMiles(dest, cabin) * peak(date) * (0.7 + rnd() * 0.9)) / 500) * 500;
            awards.push({
              origin: a,
              dest: b,
              date,
              program,
              cabin,
              miles,
              taxes: Math.round(20 + rnd() * (program === "british" ? 200 : 90)),
              taxesCurrency: "USD",
              direct: rnd() < 0.4,
              seats: 1 + Math.floor(rnd() * 6),
              airlines: AIRLINES[program],
            });
          }
        }
      }
    }
  }
}

const generated = new Date().toISOString();
fs.writeFileSync("data/cash.json", JSON.stringify({ generated, sample: true, currency: "USD", entries: cash }));
fs.writeFileSync("data/awards.json", JSON.stringify({ generated, sample: true, entries: awards }));
console.log(`Sample data: ${cash.length} cash entries, ${awards.length} award entries.`);
