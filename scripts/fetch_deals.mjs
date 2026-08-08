// Pull recent posts from points/deals blogs via RSS, keep the ones relevant
// to this household (Delta miles + Amex points, East Coast origins, the
// configured destinations), and write data/deals.json. Headlines and links
// only — reading happens on the source site. No API keys needed.
import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync("data/config.json", "utf8"));

const FEEDS = [
  { source: "Frequent Miler", url: "https://frequentmiler.com/feed/" },
  { source: "LoyaltyLobby", url: "https://loyaltylobby.com/feed/" },
  { source: "One Mile at a Time", url: "https://onemileatatime.com/feed/" },
  { source: "Danny the Deal Guru", url: "https://dannydealguru.com/feed/" },
  { source: "AwardWallet News", url: "https://awardwallet.com/news/feed/" },
  { source: "Thrifty Traveler", url: "https://thriftytraveler.com/feed/" },
  { source: "View from the Wing", url: "https://viewfromthewing.com/feed/" },
  { source: "Miles to Memories", url: "https://milestomemories.com/feed/" },
];

const MAX_AGE_DAYS = 21;
const KEYWORDS = {
  program: [
    "delta", "skymiles", "flying blue", "air france", "klm", "virgin atlantic",
    "aeroplan", "avios", "british airways", "iberia", "aer lingus",
    "membership rewards", "amex transfer", "skyteam",
  ],
  strongDeal: [
    "flash sale", "award sale", "promo rewards", "mistake fare",
    "transfer bonus", "sweet spot", "award chart", "fare sale",
  ],
  genericDeal: ["sale", "discount", "price drop", "% off", "percent off", "off award", "reduced"],
  place: [
    "europe", "transatlantic", "caribbean", "hawaii", "japan",
    "paris", "amsterdam", "milan", "rome", "madrid", "barcelona", "lisbon",
    "dublin", "london", "munich", "frankfurt", "vienna", "zurich", "prague",
    "budapest", "copenhagen", "stockholm", "athens", "reykjavik", "istanbul",
    ...cfg.origins.map((o) => o.toLowerCase()),
    "richmond", "new york", "washington", "boston", "atlanta", "philadelphia",
  ],
};

function stripCdata(s) {
  return (s || "")
    .replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&#821[67];/g, "'")
    .replace(/&#822[01];/g, '"').replace(/&quot;/g, '"').replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#8211;|&#8212;/g, "–")
    .trim();
}

function parseItems(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const pick = (tag) => stripCdata((block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)) || [])[1]);
    const title = pick("title");
    const link = pick("link");
    const pubDate = pick("pubDate");
    const desc = pick("description").replace(/<[^>]+>/g, " ").slice(0, 400);
    if (title && link) items.push({ title, link, pubDate, desc });
  }
  return items;
}

function tagsFor(text) {
  const t = text.toLowerCase();
  const hit = (kind) => KEYWORDS[kind].filter((w) => t.includes(w));
  const programs = hit("program");
  const strongDeals = hit("strongDeal");
  const places = hit("place");
  const dealWord = hit("genericDeal").length > 0;
  // Two tiers: "deal" = an explicit award-sale phrase, or a program we hold
  // paired with a discount word (actionable now). "news" = a program we hold
  // mentioned at all (worth a skim). Everything else drops — card signup
  // bonuses, cash-back offers, general travel news.
  const kind = strongDeals.length || (programs.length && dealWord) ? "deal" : programs.length ? "news" : null;
  if (!kind) return { kind: null, tags: [], score: 0 };
  const score = programs.length * 3 + strongDeals.length * 3 + (dealWord ? 2 : 0) + places.length;
  const tags = [...new Set([...programs, ...strongDeals, ...places])];
  return { kind, tags, score };
}

const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
const entries = [];
for (const feed of FEEDS) {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (AwardScout RSS reader; personal use)" },
    });
    if (!res.ok) {
      console.log(`${feed.source}: HTTP ${res.status}`);
      continue;
    }
    const items = parseItems(await res.text());
    let kept = 0;
    for (const item of items) {
      const when = Date.parse(item.pubDate);
      if (!when || when < cutoff) continue;
      const { kind, tags, score } = tagsFor(item.title + " " + item.desc);
      if (!kind) continue;
      entries.push({
        title: item.title,
        link: item.link,
        source: feed.source,
        date: new Date(when).toISOString(),
        kind,
        tags,
        score,
      });
      kept++;
    }
    console.log(`${feed.source}: ${items.length} items, kept ${kept}`);
  } catch (err) {
    console.log(`${feed.source}: ${err.message}`);
  }
}

entries.sort((a, b) => b.date.localeCompare(a.date));
const deals = entries.filter((e) => e.kind === "deal").slice(0, 40);
const news = entries.filter((e) => e.kind === "news").slice(0, 25);
fs.writeFileSync(
  "data/deals.json",
  JSON.stringify({ generated: new Date().toISOString(), entries: [...deals, ...news] })
);
console.log(`Wrote data/deals.json: ${deals.length} deals, ${news.length} news items.`);
