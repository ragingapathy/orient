# Orient

A personal tool for getting to know a city. I'm building it for Toledo, Ohio, and I use it to keep track of places I've been, places I'd like to go, and the small things worth remembering about them.

**Right now there is no reason for anyone else to use it.** It is an early prototype, it changes often, nothing about it is finished, and I'm not offering support. It is public because it's easier to keep my work in one place, and because someone might find a piece of it useful.

## What it does

Orient is a private map that lives in your browser.

- Save places, and log a visit each time you go with one tap. Orient keeps the count and the dates, shows where you go most, and can draw a heat map from it. Nothing is tracked: there is no GPS, no automatic check-in, and no account.
- Start a place from its website: paste an address and Orient fills in the name, category, address, phone, hours and social links the page publishes, for you to check before anything is saved.
- Keep your own notes, ratings, and categories for each place.
- Make short outings ("circuits") from places you've saved, and see them on the map.
- Keep a small calendar of repeating things (a weekly special, a monthly market) and see what's happening today.
- Look up an address or a business name, and optionally read a place's own website for its hours, phone number and published events.
- Everything personal is stored in this browser (`localStorage`) and can be exported and imported as a file. Fog covers the parts of the map you haven't marked yet.

The feature-by-feature record of how it got here is in [CHANGELOG.md](CHANGELOG.md).

## Running it

You need Node.js 18 or later. There is nothing to install or build.

```
node server.cjs
```

Then open http://127.0.0.1:4173. On Windows, `.\start.ps1` does the same thing, and `.\start.ps1 -Port 4174` picks another port. The server only listens on this computer unless you set `HOST` yourself.

## Places

A fresh copy starts with four made-up example places (`public/catalog.sample.js`) so the map isn't empty. They are labeled as demos, can be hidden from the field kit, and are not real businesses.

To start with your own places instead, create `public/catalog.local.js`. It is ignored by git, loads first, and replaces the examples. It should set `window.ORIENT_CATALOG` to a list shaped like the one in the sample file. Nothing from anyone's local catalog is part of this repository.

## What leaves your computer

Only things you ask for:

- **Map tiles** come from [OpenFreeMap](https://openfreemap.org/), so that service sees the area you're looking at.
- **Address and place lookups** go through the local server to the [U.S. Census geocoder](https://geocoding.geo.census.gov/) (street addresses) or [Photon](https://github.com/komoot/photon) (business names), after you press the button. Typing alone sends nothing.
- **Nearby places** use [Overpass](https://overpass-api.de/) (OpenStreetMap data), with the server limiting how often it asks.
- **Reading a website** fetches only the address you chose, checks `robots.txt`, refuses private and local addresses, and shows you what it found before anything is saved.

Saved places, visits, notes, ratings and circuits are not sent anywhere.

## How it's put together

- `public/` is the whole app: plain JavaScript and CSS, no build step. `app.js` holds the main flows; the rest are small modules (calendar, circuits, fog, discovery, website reading, and so on).
- `server.cjs` serves `public/` and a few small endpoints for lookups. `geocode.cjs`, `places.cjs` and `website.cjs` hold the bounded, cached requests.
- `ical.cjs` and `public/calendar-dates.js` handle recurrence and time zones. The recurrence engine is adapted from [Lateral](https://github.com/ragingapathy/lateral).
- `public/vendor/` has pinned copies of MapLibre GL JS and Lucide, and the Isometra typeface, each with its license.

## Checks

The `*-check.cjs` files are browser checks written for Playwright and Chrome. They are for my own use and are not a polished test suite. Set `ORIENT_PLAYWRIGHT` to the folder of a Playwright install to run one against a running server. Some checks assume my local catalog and skip themselves without `public/catalog.local.js`. Several of them are out of date with the current interface and fail; bringing them back is part of the ongoing work. `npm run check` only checks syntax.

## Credits and license

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Basemap by OpenFreeMap. See `public/vendor/` for the MapLibre GL JS, Lucide and Isometra licenses.

Orient is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may use and change it for noncommercial purposes.
