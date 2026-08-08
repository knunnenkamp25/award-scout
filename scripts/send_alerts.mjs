// Decide whether anything alert-worthy happened this refresh, and notify.
//
// Triggers:
//   1. New actionable deal headlines (strict tier) not alerted before.
//   2. All-time-low award price for a destination/cabin/window — only once
//      at least MIN_SNAPSHOTS of history exist, and only when the price is
//      lower than the last value we alerted for that key (no repeats).
//
// Delivery: POST to ntfy.sh/<NTFY_TOPIC> when that secret is set (instant
// phone push via the ntfy app); otherwise open a GitHub issue on this repo,
// which GitHub emails to the owner. State lives in data/alert-state.json.
import fs from "node:fs";

const MIN_SNAPSHOTS = 10;

function load(path, fallback) {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); } catch { return fallback; }
}
const cfg = load("data/config.json", null);
const awards = load("data/awards.json", null);
const deals = load("data/deals.json", { entries: [] });
const state = load("data/alert-state.json", { deals: [], lows: {} });

const alerts = [];

/* ---- 1. new strict-tier deal headlines ---- */
const seen = new Set(state.deals);
for (const d of deals.entries.filter((e) => (e.kind ?? "deal") === "deal")) {
  if (seen.has(d.link)) continue;
  seen.add(d.link);
  alerts.push(`🎯 ${d.source}: ${d.title}\n${d.link}`);
}
state.deals = [...seen].slice(-300);

/* ---- 2. all-time-low award prices ---- */
if (awards && !awards.sample && cfg) {
  const lines = fs.existsSync("data/history.ndjson")
    ? fs.readFileSync("data/history.ndjson", "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((l) => l && l.windows)
    : [];
  if (lines.length >= MIN_SNAPSHOTS) {
    const prior = lines.slice(0, -1); // exclude the snapshot this run just appended
    for (const w of cfg.windows) {
      for (const dest of cfg.destinations) {
        for (const [key, cabin] of [["e", "economy"], ["b", "business"]]) {
          const series = prior.map((l) => l.windows[w.id]?.[dest]?.[key]?.m).filter(Boolean);
          if (series.length < MIN_SNAPSHOTS - 1) continue;
          const nowEntry = lines[lines.length - 1].windows[w.id]?.[dest]?.[key];
          if (!nowEntry) continue;
          const allTimeMin = Math.min(...series);
          const stateKey = `${w.id}|${dest}|${key}`;
          const lastAlerted = state.lows[stateKey] ?? Infinity;
          if (nowEntry.m < allTimeMin && nowEntry.m < lastAlerted) {
            state.lows[stateKey] = nowEntry.m;
            alerts.push(
              `📉 All-time low: ${dest} ${cabin} (${w.label}) — ${Math.round(nowEntry.m / 1000)}k miles via ${nowEntry.p} from ${nowEntry.o} on ${nowEntry.d} (was ${Math.round(allTimeMin / 1000)}k)`
            );
          }
        }
      }
    }
  }
}

fs.writeFileSync("data/alert-state.json", JSON.stringify(state));

if (!alerts.length) {
  console.log("Nothing alert-worthy this run.");
  process.exit(0);
}

const title = `Award Scout: ${alerts.length} alert${alerts.length === 1 ? "" : "s"}`;
const body = alerts.join("\n\n");
console.log(title + "\n" + body);

const topic = process.env.NTFY_TOPIC;
if (topic) {
  const res = await fetch("https://ntfy.sh/" + encodeURIComponent(topic), {
    method: "POST",
    headers: { Title: "Award Scout", Priority: "high", Tags: "airplane" },
    body,
  });
  console.log(`ntfy push: ${res.status}`);
} else if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ title, body, labels: ["alert"] }),
  });
  console.log(`GitHub issue: ${res.status}`);
} else {
  console.log("No delivery channel configured (set NTFY_TOPIC secret for phone push).");
}
