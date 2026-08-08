// Curated destination gateways, grouped by region.
// tags drive the little context note shown on each result card.
const DESTINATIONS = [
  // --- Europe ---
  { code: "CDG", city: "Paris",      country: "France",      region: "Europe", note: "Air France hub — check Flying Blue Promo Rewards first; Delta flies nonstop from many US cities." },
  { code: "AMS", city: "Amsterdam",  country: "Netherlands", region: "Europe", note: "KLM hub — Flying Blue territory; strong Delta nonstop network. Great winter city." },
  { code: "MXP", city: "Milan",      country: "Italy",       region: "Europe", note: "Your gateway to Sardinia and the Alps — Delta flies JFK–MXP; cheap hops on ITA/easyJet onward." },
  { code: "FCO", city: "Rome",       country: "Italy",       region: "Europe", note: "Delta nonstops from JFK/ATL/BOS. Mild in December, thin crowds." },
  { code: "MAD", city: "Madrid",     country: "Spain",       region: "Europe", note: "Iberia Avios sweet spot (Amex 1:1) — often the cheapest business-class seat to Europe." },
  { code: "BCN", city: "Barcelona",  country: "Spain",       region: "Europe", note: "Delta seasonal nonstop; also reachable cheap via Madrid on Avios." },
  { code: "LIS", city: "Lisbon",     country: "Portugal",    region: "Europe", note: "Warmest big city in Europe in December. TAP via Aeroplan, or Delta nonstop from JFK." },
  { code: "DUB", city: "Dublin",     country: "Ireland",     region: "Europe", note: "Aer Lingus via Avios is famously cheap; US preclearance makes the trip home easy with an infant." },
  { code: "LHR", city: "London",     country: "UK",          region: "Europe", note: "Tons of space on Delta/Virgin — but watch UK surcharges; Virgin Atlantic points on Delta metal is the play." },
  { code: "EDI", city: "Edinburgh",  country: "UK",          region: "Europe", note: "Hogmanay (New Year) is world-famous; lower fees than London on some awards." },
  { code: "MUC", city: "Munich",     country: "Germany",     region: "Europe", note: "Christmas market central — Lufthansa via Aeroplan (Amex 1:1)." },
  { code: "FRA", city: "Frankfurt",  country: "Germany",     region: "Europe", note: "Biggest Lufthansa gateway, frequent award space; markets + easy trains everywhere." },
  { code: "VIE", city: "Vienna",     country: "Austria",     region: "Europe", note: "Storybook Christmas markets; Austrian via Aeroplan." },
  { code: "ZRH", city: "Zurich",     country: "Switzerland", region: "Europe", note: "Swiss via Aeroplan; the Alps in December, obviously." },
  { code: "PRG", city: "Prague",     country: "Czechia",     region: "Europe", note: "One-stop via most hubs; among Europe's prettiest Christmas markets and cheap on the ground." },
  { code: "BUD", city: "Budapest",   country: "Hungary",     region: "Europe", note: "Thermal baths in winter; one-stop via AMS/CDG/FRA." },
  { code: "CPH", city: "Copenhagen", country: "Denmark",     region: "Europe", note: "SAS is SkyTeam now — bookable with Delta miles or Flying Blue; peak hygge season." },
  { code: "ARN", city: "Stockholm",  country: "Sweden",      region: "Europe", note: "SAS (SkyTeam) — often overlooked, good award space." },
  { code: "ATH", city: "Athens",     country: "Greece",      region: "Europe", note: "Mild winters, empty ruins; usually one-stop in December (nonstops are seasonal)." },
  { code: "KEF", city: "Reykjavik",  country: "Iceland",     region: "Europe", note: "Short flight, northern lights season; Icelandair or Delta seasonal." },
  { code: "IST", city: "Istanbul",   country: "Türkiye",     region: "Europe", note: "Turkish Airlines via Aeroplan; a warm-ish, food-first winter pick." },

  // --- Caribbean & Mexico ---
  { code: "SJU", city: "San Juan",   country: "Puerto Rico", region: "Caribbean/Mexico", note: "No passport needed; Delta nonstops and frequent SkyMiles flash sales." },
  { code: "CUN", city: "Cancún",     country: "Mexico",      region: "Caribbean/Mexico", note: "Massive Delta capacity = frequent cheap awards." },
  { code: "AUA", city: "Aruba",      country: "Aruba",       region: "Caribbean/Mexico", note: "Outside the hurricane belt; strong December weather." },
  { code: "SXM", city: "St. Maarten",country: "Sint Maarten",region: "Caribbean/Mexico", note: "Delta and partners; famous beach landings." },
  { code: "MBJ", city: "Montego Bay",country: "Jamaica",     region: "Caribbean/Mexico", note: "Wide award availability on Delta." },

  // --- Elsewhere ---
  { code: "HNL", city: "Honolulu",   country: "USA (Hawaii)",region: "Farther afield", note: "Virgin Atlantic points on Delta metal is a classic Hawaii sweet spot." },
  { code: "GRU", city: "São Paulo",  country: "Brazil",      region: "Farther afield", note: "It's summer there in December; Delta + LATAM partnership." },
  { code: "EZE", city: "Buenos Aires",country:"Argentina",   region: "Farther afield", note: "Southern-hemisphere summer; long flight but no jet lag (same time zones)." },
  { code: "NRT", city: "Tokyo",      country: "Japan",       region: "Farther afield", note: "Virgin Atlantic points on Delta metal to Japan is one of the best deals in all of points." },
];

const REGIONS = ["Europe", "Caribbean/Mexico", "Farther afield"];

// Destinations pre-selected the first time the app loads (Europe defaults).
const DEFAULT_SELECTED = ["CDG", "AMS", "MXP", "FCO", "MAD", "LIS", "DUB", "MUC", "VIE", "CPH"];
