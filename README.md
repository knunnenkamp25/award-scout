# 🧭 Award Scout

A tiny static web app for people with **flexible travel plans** and a pile of miles.
You give it a vague idea — *"about a week in Europe, around Christmas, 2 adults + a lap infant, no more than one stop"* — and it fans that out into every search you'd otherwise build by hand: Google Flights (cash baseline, with its price-graph doing the date sweep), Delta SkyMiles, and the Amex transfer partners that often price the same seats for fewer miles.

**Live site:** enable GitHub Pages on this repo (Settings → Pages → Deploy from branch → `main` / root) and it's served at `https://<user>.github.io/award-scout/`.

## What it does

- **Best Options** — ranked destinations by real award and cash prices across your whole flexible window, with from-home positioning math. Star (⭐) any option to **watch it**: the app remembers the price you saw and shows the change every time data refreshes.
- **Deals** — a twice-daily radar over eight points blogs' RSS feeds (Frequent Miler, LoyaltyLobby, One Mile at a Time, Danny the Deal Guru, AwardWallet News, Thrifty Traveler, View from the Wing, Miles to Memories), filtered to actionable award sales for the programs this household holds, with a lighter program-news tier below. Headlines link to the source.
- **Trends** — every refresh appends the day's best prices to `data/history.ndjson`. After ~10 snapshots the tab starts showing now-vs-typical-vs-lowest per destination; months of data reveal the real pattern of when to fly and book.
- **Search fan-out** — pick origins, a target date ± flexibility, a trip-length range, cabin, passengers, and destinations (curated Europe/Caribbean lists with award-program notes, or add any airport). One click per destination opens a pre-filled search; an expander gives you every individual date pair if you want the full grid.
- **Trip log** — record what each search found (cash price, miles, taxes), and it computes cents-per-mile so you can see instantly whether an award beats paying cash. Exports CSV. Everything stays in your browser (localStorage) — no accounts, no server.
- **Cheat sheet** — which Amex transfer partner to check for which route, infant-on-award rules, and the one-stop hub trick.

## Architecture

Pure static site — `index.html` + vanilla JS/CSS, no build step, no dependencies. Works on phone and desktop. A scheduled GitHub Action ([refresh-data.yml](.github/workflows/refresh-data.yml)) pulls prices into `data/*.json` twice a day; the **Best Options** tab reads those snapshots and ranks destinations by real miles and dollars. No server needed at any point.

`data/config.json` controls what gets fetched: origins, destinations, the date window, trip length, and cabins. Edit it and push — the workflow re-runs automatically.

### Setup: connecting real data

The repo ships with clearly-labeled **sample data** so the UI works out of the box. To get real prices, add API credentials as **repository secrets** (Settings → Secrets and variables → Actions → New repository secret — secrets stay private even in a public repo):

| Secret name | Where to get it | Cost | Powers |
|---|---|---|---|
| `SEATS_AERO_API_KEY` | [seats.aero Pro](https://seats.aero/pro) → account settings → API | $9.99/mo | Award availability & miles pricing across Delta, Flying Blue, Virgin Atlantic, Aeroplan, Avios, and more — refreshed twice daily |
| `SERPAPI_KEY` | [serpapi.com](https://serpapi.com) → free account → API key | Free (100 searches/mo) | Cash benchmark per destination from Google Flights — refreshed on the 1st & 15th (an anchor round-trip in the middle of the window; feeds the ¢/mile value math) |

Either feed works alone. After adding secrets, run each workflow once by hand: Actions tab → "Refresh price data" / "Refresh cash benchmarks" → Run workflow.

> **Note:** Amadeus Self-Service (this project's original cash source) shut down for new registrations in July 2026, which is why cash comes from SerpAPI's Google Flights engine instead.

The award fetcher uses the [seats.aero Partner API](https://developers.seats.aero/) (personal, non-commercial use per their terms). Round trips are computed as best outbound + best return one-way awards, which may come from two different programs — that's real bookability, since one-way awards book independently.

## Notes

- Delta doesn't accept prefilled search URLs (their old deep-link format now errors out), so the Delta button opens their search form and copies your route/dates to the clipboard for quick entry.
- This is a personal, non-commercial tool.
