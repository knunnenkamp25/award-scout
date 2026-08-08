/* Deals tab (RSS headlines from data/deals.json) and Trends tab
   (price history from data/history.ndjson). */

function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

async function initDeals() {
  const list = $("#deals-list");
  let deals = null;
  try {
    const res = await fetch("data/deals.json?t=" + Date.now());
    if (res.ok) deals = await res.json();
  } catch { /* no file yet */ }

  if (!deals?.entries?.length) {
    list.innerHTML =
      '<div class="card"><p class="hint">No deal headlines yet — they appear after the next "Refresh price data" run (no API key needed for this feed).</p></div>';
    return;
  }
  const row = (d) => `
    <div class="deal-row">
      <div class="deal-meta"><span class="deal-source">${d.source}</span> · ${timeAgo(d.date)}</div>
      <a class="deal-title" href="${d.link}" target="_blank" rel="noopener">${d.title}</a>
      <div class="deal-tags">${d.tags.slice(0, 4).map((t) => `<span class="deal-tag">${t}</span>`).join("")}</div>
    </div>`;
  const hot = deals.entries.filter((d) => (d.kind ?? "deal") === "deal");
  const news = deals.entries.filter((d) => d.kind === "news");
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML =
    `<div class="price-label">🎯 Actionable deals</div>` +
    (hot.length
      ? hot.map(row).join("")
      : '<p class="hint">No live award sales on the radar right now — Delta flash sales usually run 72 hours and will show up here within hours of being announced. Checked twice daily.</p>') +
    (news.length ? `<div class="price-label" style="margin-top:1rem">📰 Program news worth a skim</div>` + news.map(row).join("") : "");
  list.appendChild(card);
}

async function initTrends() {
  const el = $("#trends-content");
  let lines = [];
  try {
    const res = await fetch("data/history.ndjson?t=" + Date.now());
    if (res.ok) {
      const text = await res.text();
      lines = text.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    }
  } catch { /* no file yet */ }

  lines = lines.filter((l) => l.windows); // per-window format only
  if (lines.length < 10) {
    const since = lines[0] ? new Date(lines[0].ts).toLocaleDateString() : "the next real data refresh";
    el.innerHTML = `<div class="card"><p class="hint">📈 Collecting: <strong>${lines.length}</strong> snapshot${lines.length === 1 ? "" : "s"} so far (recording started ${lines[0] ? since : "with " + since}). Trends unlock at 10+ snapshots — about a week of the twice-daily refresh — and get sharper for months after that.</p></div>`;
    return;
  }

  const latest = lines[lines.length - 1];
  let html = "";
  for (const w of DATA.config?.windows || []) {
    const dests = [...new Set(lines.flatMap((l) => Object.keys(l.windows[w.id] || {})))];
    const rows = dests
      .map((code) => {
        const series = lines.map((l) => l.windows[w.id]?.[code]?.e?.m).filter(Boolean);
        if (!series.length) return null;
        const sorted = [...series].sort((a, b) => a - b);
        const min = sorted[0];
        const median = sorted[Math.floor(sorted.length / 2)];
        const now = latest.windows[w.id]?.[code]?.e?.m ?? null;
        const verdict = now == null ? "—" : now <= min ? "🔥 all-time low" : now <= median ? "below typical" : "above typical";
        const meta = destByCode(code);
        return { code, city: meta?.city || code, min, median, now, verdict };
      })
      .filter(Boolean)
      .sort((a, b) => (a.now ?? Infinity) - (b.now ?? Infinity));
    if (!rows.length) continue;
    html += `
      <div class="card"><h3 style="margin-top:0">${w.label}</h3><div class="table-wrap"><table>
        <thead><tr><th>Destination</th><th>Now (econ)</th><th>Lowest seen</th><th>Typical</th><th>Read</th></tr></thead>
        <tbody>${rows
          .map(
            (r) => `<tr><td>${r.city} <span class="dest-code">${r.code}</span></td>
              <td>${r.now ? fmtMiles(r.now) : "—"}</td><td>${fmtMiles(r.min)}</td><td>${fmtMiles(r.median)}</td>
              <td>${r.verdict}</td></tr>`
          )
          .join("")}</tbody>
      </table></div></div>`;
  }
  el.innerHTML =
    (html || '<div class="card"><p class="hint">No trend rows yet for the configured windows.</p></div>') +
    `<p class="hint" style="padding:0 .5rem">${lines.length} snapshots since ${new Date(lines[0].ts).toLocaleDateString()}. "Typical" is the median observed best price.</p>`;
}

/* ---------- data health footer ---------- */
async function initHealth() {
  const el = $("#health-line");
  if (!el) return;
  const age = (iso) => {
    const h = (Date.now() - new Date(iso)) / 3600000;
    return h < 1 ? "<1h" : h < 48 ? Math.round(h) + "h" : Math.round(h / 24) + "d";
  };
  const parts = [];
  const [awards, cash] = await Promise.all([loadJson("data/awards.json"), loadJson("data/cash.json")]);
  if (awards) parts.push(`awards ${awards.sample ? "⚠️ sample" : age(awards.generated) + " old"}`);
  if (cash) parts.push(`cash ${cash.sample ? "⚠️ sample" : age(cash.generated) + " old"}`);
  try {
    const onPages = location.hostname.endsWith("github.io");
    const owner = onPages ? location.hostname.split(".")[0] : "knunnenkamp25";
    const repo = onPages ? location.pathname.split("/")[1] || "award-scout" : "award-scout";
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=10`);
    if (res.ok) {
      const runs = (await res.json()).workflow_runs || [];
      const latestBy = {};
      for (const r of runs) if (!latestBy[r.name]) latestBy[r.name] = r;
      for (const [name, short] of [["Refresh price data", "award run"], ["Refresh cash benchmarks", "cash run"]]) {
        const r = latestBy[name];
        if (r) {
          const mark = r.conclusion === "success" ? "✓" : r.status === "completed" ? "✗" : "…";
          parts.push(`<a href="${r.html_url}" target="_blank" rel="noopener">last ${short} ${mark}</a>`);
        }
      }
    }
  } catch { /* offline or rate-limited — ages alone are fine */ }
  el.innerHTML = parts.join(" · ");
}
initHealth();

initDeals();
initTrends();
