// Append a compact snapshot of today's best prices to data/history.ndjson,
// keyed by travel window. One line per refresh run; over months this becomes
// the dataset for "when should we fly / book from here" trend analysis.
import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync("data/config.json", "utf8"));

function load(path) {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); } catch { return null; }
}
const awards = load("data/awards.json");
const cash = load("data/cash.json");

if (!awards || awards.sample) {
  console.log("Awards data missing or sample — not recording history.");
  process.exit(0);
}

const inWindow = (date, w) => date >= w.start && date <= w.end;

const snapshot = { ts: new Date().toISOString(), windows: {} };
for (const w of cfg.windows) {
  const dests = {};
  for (const dest of cfg.destinations) {
    const row = {};
    for (const [key, cabin] of [["e", "economy"], ["b", "business"]]) {
      let best = null;
      for (const en of awards.entries) {
        if (en.dest !== dest || en.cabin !== cabin || !cfg.origins.includes(en.origin)) continue;
        if (!inWindow(en.date, w)) continue;
        if (!best || en.miles < best.miles) best = en;
      }
      if (best) row[key] = { m: best.miles, d: best.date, p: best.program, o: best.origin, nd: best.direct ? 1 : 0 };
    }
    if (cash && !cash.sample) {
      let cheapest = null;
      for (const en of cash.entries) {
        if (en.dest !== dest || !en.price || !inWindow(en.dep, w)) continue;
        if (!cheapest || en.price < cheapest) cheapest = en.price;
      }
      if (cheapest) row.c = cheapest;
    }
    if (Object.keys(row).length) dests[dest] = row;
  }
  snapshot.windows[w.id] = dests;
}

fs.appendFileSync("data/history.ndjson", JSON.stringify(snapshot) + "\n");
const counts = Object.entries(snapshot.windows).map(([id, d]) => `${id}:${Object.keys(d).length}`).join(", ");
console.log(`Appended history snapshot (${counts}).`);
