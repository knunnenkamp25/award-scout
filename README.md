# 🧭 Award Scout

A tiny static web app for people with **flexible travel plans** and a pile of miles.
You give it a vague idea — *"about a week in Europe, around Christmas, 2 adults + a lap infant, no more than one stop"* — and it fans that out into every search you'd otherwise build by hand: Google Flights (cash baseline, with its price-graph doing the date sweep), Delta SkyMiles, and the Amex transfer partners that often price the same seats for fewer miles.

**Live site:** enable GitHub Pages on this repo (Settings → Pages → Deploy from branch → `main` / root) and it's served at `https://<user>.github.io/award-scout/`.

## What it does

- **Search fan-out** — pick origins, a target date ± flexibility, a trip-length range, cabin, passengers, and destinations (curated Europe/Caribbean lists with award-program notes, or add any airport). One click per destination opens a pre-filled search; an expander gives you every individual date pair if you want the full grid.
- **Trip log** — record what each search found (cash price, miles, taxes), and it computes cents-per-mile so you can see instantly whether an award beats paying cash. Exports CSV. Everything stays in your browser (localStorage) — no accounts, no server.
- **Cheat sheet** — which Amex transfer partner to check for which route, infant-on-award rules, and the one-stop hub trick.

## Architecture

Pure static site — `index.html` + vanilla JS/CSS, no build step, no dependencies. Works on phone and desktop.

### Phase 2 (planned): live award data

The plan is to layer real award availability on top via the [seats.aero Pro API](https://docs.seats.aero/article/68-seatsaero-pro-api-access-limits-and-usage):

1. A **GitHub Actions workflow** on a cron schedule calls the API with a key stored as a **repo secret** (safe in a public repo).
2. It writes JSON snapshots of availability for the configured regions into `data/`.
3. The frontend reads those snapshots and shows best-by-miles results directly, sorted and filtered, instead of only linking out.

No server needed at any point.

## Notes

- Delta doesn't accept prefilled search URLs (their old deep-link format now errors out), so the Delta button opens their search form and copies your route/dates to the clipboard for quick entry.
- This is a personal, non-commercial tool.
