# Orient

A personal tool for getting to know a city. I'm building it for Toledo, Ohio, and I use it to keep track of places I've been, places I'd like to go, and the small things worth remembering about them.

**Right now there is no reason for anyone else to use it.** It is an early prototype, it changes often, nothing about it is finished, and I'm not offering support. It is public because it's easier to keep my work in one place, and because someone might find a piece of it useful.

## What it does

Orient is a private map that lives in your browser.

- Save places, and log a visit each time you go with one tap. Orient keeps the count and the dates, shows where you go most, and can draw a heat map from it. Nothing is tracked: there is no GPS, no automatic check-in, and no account.
- Start a place from its website: paste an address and Orient fills in the name, category, address, phone, hours and social links the page publishes, for you to check before anything is saved.
- Keep your own notes, ratings, and categories for each place.
- The Add menu starts with **Photo + note** or **Name of place**. Choose Name of place to reveal the full place form, including address and website tools; Back returns to the two choices.
- **Add a place → Photo + note** creates a standalone photo memory: pick a picture, optionally write a note, and save. No name, category, or address form is required. GPS supplies the pin coordinates; without readable GPS, center the map first and explicitly choose **Use map center**. Attaching to an existing place is optional rather than automatic. A photo memory opens with its picture and note as the main content and survives sync and backups.
- Photo uploads read embedded GPS locally before resizing. **My Map → List → Add a place photo** starts from an image; a place card’s Add a photo uses the same destination picker. Known places within 100 m are suggested; a match is preselected only within 35 m with at least a 15 m lead over the next candidate. Check the destination, choose another place, or name a new place at the photo’s coordinates. Missing/unsupported GPS falls back to manual selection. No reverse geocoder or image upload service is used. The saved JPEG copy has its embedded metadata removed. GPS reading uses vendored [exifr 7.1.3](https://github.com/MikeKovarik/exifr), MIT license in `public/vendor/exifr-LICENSE.txt`.
- Append photos to any place—shops, parks, benches, or your own discoveries—with an editable note per photo. Open **Photos & notes** in the expanded place card, choose a file or take a photo, and save. Smaller JPEG copies are kept with the private map, including sync and JSON backups; originals stay untouched. Adding is limited to 12 photos per place, about 110 KB per photo, and about 1.3 MB of compressed images across the album to fit current browser/sync storage. Orient reports capacity errors rather than evicting existing photos. HEIC works only when the browser can decode it; otherwise choose JPEG/PNG. Map imports accept up to 3 MB.
- Bring in your own Google Maps data from a Google Takeout export: saved lists (the CSV files in the Saved folder), Saved Places, and optionally Timeline visits. See Importing from Google below.
- Open directions in the maps app you prefer: Apple Maps, Google Maps, Waze or OpenStreetMap, or let Orient choose on a phone. The choice is kept on each device.
- Make short outings ("circuits") from places you've saved, and see them on the map.
- Keep a small calendar of repeating things (a weekly special, a monthly market) and see what's happening today.
- Today’s events and specials also inform outing suggestions, with the specific reason, listed time, and source shown on the recommendation. Timed listings must fit the available outing window; listed today does not mean open now.
- In Today, use **Get me out for a bit** for up to two small outings based on available time, walking or driving, spending intentions, and people energy. Suggestions run locally and favor saved, unvisited places; ratings of 1–2 are excluded. Travel is estimated, hours and atmosphere are unverified, and dollar budgets are reminders until prices are known. No-spend plans suggest outdoor walks. Preferences last only until the page reloads; the starting point is downtown Toledo or a map center you choose, never GPS.
- Look up an address or a business name, and optionally read a place's own website for its hours, phone number and published events.
- Your map is kept in the browser and synced to the computer running Orient, so a phone and a laptop show the same places and visits (see Syncing below). It can also be exported and imported as a file. Fog covers the parts of the map you haven't marked yet.

The feature-by-feature record of how it got here is in [CHANGELOG.md](CHANGELOG.md).

## Running it

You need Node.js 18 or later. There is nothing to install or build.

```
node server.cjs
```

To keep it running in the background and bring it back after a restart, use Docker instead (`docker compose up -d`; see `docker-compose.yml`). It reads this folder, keeps your data in `./data`, and publishes the port on this computer only.

Then open http://127.0.0.1:4173. On Windows, `.\start.ps1` does the same thing, and `.\start.ps1 -Port 4174` picks another port. The server only listens on this computer unless you set `HOST` yourself.

## Places

A fresh copy starts with four made-up example places (`public/catalog.sample.js`) so the map isn't empty. They are labeled as demos, can be hidden from the field kit, and are not real businesses.

To start with your own places instead, create `public/catalog.local.js`. It is ignored by git, loads first, and replaces the examples. It should set `window.ORIENT_CATALOG` to a list shaped like the one in the sample file. Nothing from anyone's local catalog is part of this repository.

## Syncing between devices

A browser's storage belongs to one address, so a laptop at `127.0.0.1` and a phone at your public address would otherwise each keep their own map. To keep them the same, the computer running Orient holds one copy in `data/orient-state.json` (ignored by git), and each browser keeps its own copy too, so it still works offline.

- Open Orient on that computer, choose the settings button, then **Pair a phone**. Enter the address your phone uses and open the link it makes on the phone once. The phone then syncs whenever it can reach the computer.
- That computer, opened directly, is trusted. Anything arriving through a tunnel or over the network needs the pairing key, which is made on first use and shown only on that computer. **Make a new key** unpairs every phone.
- Edits made on two devices are merged, not overwritten: visits and saved places from both are kept, and something you removed stays removed. If you change the very same single value on both, the device that syncs last wins.
- The computer has to be on for other devices to update. Set `ORIENT_SYNC=off` to turn the sync endpoints off, and `ORIENT_DATA_DIR` to keep the copy elsewhere.
- Whoever holds the key can read and change your map, so keep it to yourself.

## Importing from Google

Your places are yours to take out of Google Maps. Request a [Google Takeout](https://takeout.google.com/) export of **Saved** (your lists as CSV files) and **Maps (your places)** (`Saved Places.json`). In Orient, open the settings button, choose **Import from Google**, and pick the files; you can select several at once. Orient reads them in the browser, shows what it found, and adds the places you tick as saved places. Duplicates of places already on your map are skipped, so importing twice is safe.

- Many saved-list exports have a name and a Google link but no coordinates. **Look up by name** sends only the place name to the local address reader, which uses Photon, and offers the matches for you to check. A name can match the wrong city, so matches more than 60 miles from your map are left out unless you include them.
- **Timeline** is optional. If you pick a Timeline file, Orient adds a dated visit only for places that are already on your map (within about 75 metres), one per place per day, and discards everything else in the file unread. This feeds the visit counts and heat map. Files over 200 MB are refused; export a shorter period instead.
- The readers follow Google's documented export shapes. If a file isn't recognised, the dialog says so.

## What leaves your computer

Only things you ask for:

- **Map tiles** come from [OpenFreeMap](https://openfreemap.org/), so that service sees the area you're looking at.
- **Importing from Google** reads your files in the browser. Only place names you choose to look up leave it, as below.
- **Address and place lookups** go through the local server to the [U.S. Census geocoder](https://geocoding.geo.census.gov/) (street addresses) or [Photon](https://github.com/komoot/photon) (business names), after you press the button. Typing alone sends nothing.
- **Nearby places** use [Overpass](https://overpass-api.de/) (OpenStreetMap data), with the server limiting how often it asks.
- **Reading a website** fetches only the address you chose, checks `robots.txt`, refuses private and local addresses, and shows you what it found before anything is saved.

Saved places, visits, notes, ratings and circuits are not sent to anyone. They sync only to the computer running Orient, and only from browsers you have paired with it.

## How it's put together

- `public/` is the whole app: plain JavaScript and CSS, no build step. `app.js` holds the main flows; the rest are small modules (calendar, circuits, fog, discovery, website reading, and so on).
- `server.cjs` serves `public/` and a few small endpoints for lookups. `geocode.cjs`, `places.cjs` and `website.cjs` hold the bounded, cached requests.
- `ical.cjs` and `public/calendar-dates.js` handle recurrence and time zones. The recurrence engine is adapted from [Lateral](https://github.com/ragingapathy/lateral).
- `public/vendor/` has pinned copies of MapLibre GL JS and Lucide, and the Isometra typeface, each with its license.

## Checks

The `*-check.cjs` files are browser checks written for Playwright and Chrome. They are for my own use and are not a polished test suite. Set `ORIENT_PLAYWRIGHT` to the folder of a Playwright install to run one against a running server. Some checks assume my local catalog and skip themselves without `public/catalog.local.js`. They run in a phone-sized window, so they open the place drawer and its folded rows the way a person would. `npm run check` only checks syntax.

## Credits and license

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Basemap by OpenFreeMap. See `public/vendor/` for the MapLibre GL JS, Lucide and Isometra licenses.

Orient is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may use and change it for noncommercial purposes.
