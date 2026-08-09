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

  // --- Europe secondaries (zone-pricing gems: same miles as the hubs,
  //     less competition for the saver seats) ---
  { code: "NCE", city: "Nice",       country: "France",      region: "Europe", note: "Flying Blue prices it like Paris — Riviera for hub miles; Delta seasonal JFK nonstop." },
  { code: "GVA", city: "Geneva",     country: "Switzerland", region: "Europe", note: "Alps access; often more space than Zurich." },
  { code: "BER", city: "Berlin",     country: "Germany",     region: "Europe", note: "No Lufthansa hub dominance = better partner space." },
  { code: "HAM", city: "Hamburg",    country: "Germany",     region: "Europe", note: "Underrated Christmas markets; empty premium cabins in winter." },
  { code: "VCE", city: "Venice",     country: "Italy",       region: "Europe", note: "Winter Venice without the crowds; one-stop via most hubs." },
  { code: "NAP", city: "Naples",     country: "Italy",       region: "Europe", note: "Gateway to Amalfi/Pompeii; zone-priced same as Rome on partners." },
  { code: "BLQ", city: "Bologna",    country: "Italy",       region: "Europe", note: "Italy's food capital, forever overshadowed by Rome/Milan awards." },
  { code: "OPO", city: "Porto",      country: "Portugal",    region: "Europe", note: "Cheaper and quieter than Lisbon, same award zones." },
  { code: "FAO", city: "Faro",       country: "Portugal",    region: "Europe", note: "Algarve winter sun; Europe's mildest mainland December." },
  { code: "VLC", city: "Valencia",   country: "Spain",       region: "Europe", note: "Iberia Avios zone-priced like Madrid; paella and beaches." },
  { code: "AGP", city: "Málaga",     country: "Spain",       region: "Europe", note: "Costa del Sol winter sun; strong Avios/Iberia space." },
  { code: "SVQ", city: "Seville",    country: "Spain",       region: "Europe", note: "Best city in Spain in winter; low award demand." },
  { code: "PMI", city: "Palma",      country: "Spain",       region: "Europe", note: "Mallorca shoulder-season steal." },
  { code: "TFS", city: "Tenerife",   country: "Spain (Canaries)", region: "Europe", note: "December beach weather on Europe pricing." },
  { code: "FNC", city: "Funchal",    country: "Portugal (Madeira)", region: "Europe", note: "Madeira — eternal spring, levada hikes." },
  { code: "KRK", city: "Kraków",     country: "Poland",      region: "Europe", note: "Stunning Christmas market, half Vienna's prices on the ground." },
  { code: "RIX", city: "Riga",       country: "Latvia",      region: "Europe", note: "Baltic gem; air Baltic connections, very low award demand." },
  { code: "MLA", city: "Malta",      country: "Malta",       region: "Europe", note: "Mediterranean winter mild spot; low competition." },
  { code: "SPU", city: "Split",      country: "Croatia",     region: "Europe", note: "Adriatic shoulder-season; one-stop via FRA/MUC/CDG." },
  { code: "DBV", city: "Dubrovnik",  country: "Croatia",     region: "Europe", note: "Off-season Dubrovnik is empty and gorgeous." },

  // --- Latin America ---
  { code: "MEX", city: "Mexico City",country: "Mexico",      region: "Latin America", note: "Aeromexico is SkyTeam — Delta miles and Flying Blue both book it; huge food city." },
  { code: "SJO", city: "San José",   country: "Costa Rica",  region: "Latin America", note: "Family favorite; Delta nonstop from ATL, frequent award space." },
  { code: "LIR", city: "Liberia",    country: "Costa Rica",  region: "Latin America", note: "Guanacaste beaches; Delta seasonal nonstops." },
  { code: "PTY", city: "Panama City",country: "Panama",      region: "Latin America", note: "Copa's hub — LifeMiles and Aeroplan sweet spots via Star Alliance." },
  { code: "CTG", city: "Cartagena",  country: "Colombia",    region: "Latin America", note: "Old-city charm; one-stop via ATL/MIA hubs." },
  { code: "BOG", city: "Bogotá",     country: "Colombia",    region: "Latin America", note: "Avianca hub — LifeMiles (Amex 1:1) prices it cheap." },
  { code: "LIM", city: "Lima",       country: "Peru",        region: "Latin America", note: "LATAM via Delta partnership; gateway to Cusco." },
  { code: "SCL", city: "Santiago",   country: "Chile",       region: "Latin America", note: "Delta/LATAM joint venture — real award space from ATL." },
  { code: "GIG", city: "Rio de Janeiro", country: "Brazil",  region: "Latin America", note: "Priced like São Paulo, but it's Rio — Delta/LATAM via ATL or connections." },
  { code: "MDE", city: "Medellín",   country: "Colombia",    region: "Latin America", note: "LifeMiles surplus territory; eternal-spring weather." },
  { code: "SAL", city: "San Salvador", country: "El Salvador", region: "Latin America", note: "Avianca's hub — LifeMiles award space is almost always open." },
  { code: "UIO", city: "Quito",      country: "Ecuador",     region: "Latin America", note: "Galápagos gateway; low award demand." },
  { code: "BZE", city: "Belize City", country: "Belize",     region: "Latin America", note: "Short flight, big trip — reefs and ruins; heavy seasonal capacity." },
  { code: "GRU", city: "São Paulo",  country: "Brazil",      region: "Latin America", note: "It's summer there in December; Delta + LATAM partnership." },
  { code: "EZE", city: "Buenos Aires",country:"Argentina",   region: "Latin America", note: "Southern-hemisphere summer; long flight but no jet lag (same time zones)." },

  // --- Africa ---
  { code: "CMN", city: "Casablanca", country: "Morocco",     region: "Africa", note: "Royal Air Maroc is oneworld — Avios books it; closest African gateway." },
  { code: "CAI", city: "Cairo",      country: "Egypt",       region: "Africa", note: "Egyptair via Aeroplan (Star Alliance); pyramids in winter = perfect weather." },
  { code: "ACC", city: "Accra",      country: "Ghana",       region: "Africa", note: "Delta flies JFK–ACC nonstop — SkyMiles territory." },
  { code: "DSS", city: "Dakar",      country: "Senegal",     region: "Africa", note: "Delta's JFK–DSS nonstop; shortest hop to sub-Saharan Africa." },
  { code: "LOS", city: "Lagos",      country: "Nigeria",     region: "Africa", note: "Delta ATL–LOS nonstop." },
  { code: "NBO", city: "Nairobi",    country: "Kenya",       region: "Africa", note: "Kenya Airways is SkyTeam — Flying Blue books JFK–NBO; safari gateway." },
  { code: "JNB", city: "Johannesburg",country:"South Africa",region: "Africa", note: "Delta ATL–JNB nonstop; Virgin Atlantic points also work via LHR." },
  { code: "CPT", city: "Cape Town",  country: "South Africa",region: "Africa", note: "Delta ATL–CPT nonstop — one of the world's great cities, summer in December." },
  { code: "ADD", city: "Addis Ababa", country: "Ethiopia",   region: "Africa", note: "Ethiopian flies IAD–ADD nonstop — from YOUR airport, bookable via Aeroplan." },
  { code: "RAK", city: "Marrakech",  country: "Morocco",     region: "Africa", note: "The Morocco people actually visit; Flying Blue via CDG." },
  { code: "ZNZ", city: "Zanzibar",   country: "Tanzania",    region: "Africa", note: "KLM serves it from AMS — a Flying Blue award on Amex points few Americans search." },
  { code: "JRO", city: "Kilimanjaro", country: "Tanzania",   region: "Africa", note: "KLM nonstop from AMS — safari gateway on Flying Blue." },

  // --- USA weekends ---
  { code: "MCO", city: "Orlando",    country: "USA",         region: "USA", note: "The baby's first Disney run; Delta nonstops everywhere." },
  { code: "MIA", city: "Miami",      country: "USA",         region: "USA", note: "Winter beach weekend; heavy Delta/AA capacity keeps awards cheap." },
  { code: "TPA", city: "Tampa",      country: "USA",         region: "USA", note: "Gulf beaches; frequent SkyMiles flash-sale target." },
  { code: "RSW", city: "Fort Myers", country: "USA",         region: "USA", note: "Sanibel/Captiva beaches." },
  { code: "MSY", city: "New Orleans",country: "USA",         region: "USA", note: "Food weekend; short hop." },
  { code: "BNA", city: "Nashville",  country: "USA",         region: "USA", note: "Quick fun weekend; very cheap awards." },
  { code: "LAS", city: "Las Vegas",  country: "USA",         region: "USA", note: "Long weekend classic; deep award inventory." },
  { code: "DEN", city: "Denver",     country: "USA",         region: "USA", note: "Mountain weekends; watch basic-economy award pricing." },
  { code: "ORD", city: "Chicago",    country: "USA",         region: "USA", note: "Big-city weekend; constant award sales." },
  { code: "PWM", city: "Portland",   country: "USA (Maine)", region: "USA", note: "Lobster-roll fall weekends." },

  // --- Canada ---
  { code: "YYZ", city: "Toronto",    country: "Canada",      region: "Canada", note: "Easy international weekend; Delta + Air Canada both fly it." },
  { code: "YUL", city: "Montreal",   country: "Canada",      region: "Canada", note: "Feels like Europe without the flight; Aeroplan home turf." },
  { code: "YHZ", city: "Halifax",    country: "Canada",      region: "Canada", note: "Maritime charm; Air Canada via Aeroplan." },

  // --- Caribbean additions ---
  { code: "NAS", city: "Nassau",     country: "Bahamas",     region: "Caribbean/Mexico", note: "Shortest true-Caribbean hop; easy weekend." },
  { code: "PUJ", city: "Punta Cana", country: "Dom. Republic",region:"Caribbean/Mexico", note: "Resort direct flights; wide award availability." },

  // --- Elsewhere ---
  { code: "HNL", city: "Honolulu",   country: "USA (Hawaii)",region: "Farther afield", note: "Virgin Atlantic points on Delta metal is a classic Hawaii sweet spot." },
  { code: "NRT", city: "Tokyo",      country: "Japan",       region: "Farther afield", note: "Virgin Atlantic points on Delta metal to Japan is one of the best deals in all of points." },
];

const REGIONS = ["Europe", "Latin America", "Africa", "Caribbean/Mexico", "USA", "Canada", "Farther afield"];

// Destinations pre-selected the first time the app loads (Europe defaults).
const DEFAULT_SELECTED = ["CDG", "AMS", "MXP", "FCO", "MAD", "LIS", "DUB", "MUC", "VIE", "CPH"];
