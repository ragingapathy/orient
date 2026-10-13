# Running and using Orient

## What it does

Orient is a private map that lives in your browser.

When a dialog is open, your browser's Back button or phone's back gesture closes the foreground dialog and keeps you in Orient. Stacked dialogs close one at a time. Close buttons, Escape and tapping the backdrop still work; a dialog that is busy can refuse dismissal until its work finishes.

- On first use, choose a city or town and confirm it as your home area. Explore distances, Today and outing suggestions start there; **Field kit → Change home area** moves that starting point while keeping saved places. No GPS or home address is needed. Calendar time zone starts with the device setting and can be changed during setup. Fresh maps do not load the Toledo catalog; existing maps retain their data and starting area.
- Save places, and log a visit each time you go with one tap. Orient keeps the count and the dates, shows where you go most, and can draw a heat map from it. Nothing is tracked: there is no GPS tracking, no automatic check-in, and no account.
- Start a place from its website: paste an address and Orient fills in the name, category, address, phone, hours and social links the page publishes, for you to check before anything is saved.
- Optionally enable **Gidgit** in the Field kit. It adds an optional fourth navigation button on that device for saved-map questions and reviewed hours, note, or category updates. It stays hidden when disabled and sends nothing until you ask. It uses local Ollama on the Orient computer, defaults to the installed `qwen3.5:9b`, and has no cloud fallback. A public browser must already be paired for sync.
- Keep your own notes, ratings, and categories for each place. Enter weekly hours such as **Mon-Fri 9am-5pm; Sat 10am-2pm; Sun closed** to normalize the schedule and calculate current opening status. Unknown or ambiguous hours remain text for review.
- Select the existing **Open now** filter to darken the city and light up places open by their listed schedules. It uses your selected area’s time zone and refreshes every 30 seconds; unlisted days and unsupported holiday rules are not guessed.
- The Add menu starts with **Photo or note** or **New location**. Choose New location for the full place form, including address and website tools. Hold a finger on the map for about 0.6 seconds, or right-click on desktop, to choose Photo, Note, Photo + note, or New location at that exact point. Panning and pinching cancel the hold.
- **Add a place → Photo or note** creates a standalone memory: pick a picture, write a note, or do both, and save. No name, category, or address form is required. A long-press point takes priority over photo GPS. Otherwise GPS supplies the pin coordinates; without a chosen point or readable GPS, center the map first and explicitly choose **Use map center**. Attaching to an existing place is optional rather than automatic. A photo memory opens with its picture and note as the main content and survives sync and backups.
- Photo uploads read embedded GPS locally before resizing. **My Map → List → Add a place photo** starts from an image; a place card’s Add a photo uses the same destination picker. Known places within 100 m are suggested; a match is preselected only within 35 m with at least a 15 m lead over the next candidate. Check the destination, choose another place, or name a new place at the photo’s coordinates. Missing/unsupported GPS falls back to manual selection. No reverse geocoder or image upload service is used. The saved JPEG copy has its embedded metadata removed. GPS reading uses vendored [exifr 7.1.3](https://github.com/MikeKovarik/exifr), MIT license in `public/vendor/exifr-LICENSE.txt`.
- Append photos to any place—shops, parks, benches, or your own discoveries—with an editable note per photo. Open **Photos & notes** in the expanded place card, choose a file or take a photo, and save. Smaller JPEG copies are kept with the private map, including sync and JSON backups; originals stay untouched. Adding is limited to 12 photos per place, about 110 KB per photo, and about 1.3 MB of compressed images across the album to fit current browser/sync storage. Orient reports capacity errors rather than evicting existing photos. HEIC works only when the browser can decode it; otherwise choose JPEG/PNG. Map imports accept up to 3 MB.
- Crowded pins: pins that overlap fold into one round button with a count. Tap it to zoom in; for places at exactly the same spot it opens a short list. The place you have open is always shown on its own.
- Icons: saved places wear a small gold star on the map, and visited ones a small check badge (they keep their own icon). Tap the icon on a place card to pick a different one for that place; **Use the usual icon** puts it back.
- Spending: expand a place and open **Spending** to write down what you spent and when. Orient keeps the total and average for that place. Mark each place **Local** or **Chain** and My Map shows **Where your money goes**: how much of what you sorted stayed with local businesses, against chains and corporations. You choose which a place is; Orient only hints. Tap **Add spend** after logging a visit to jump straight to the amount box, or **Same as last time** to repeat the latest amount in one tap. With two months of spending, My Map also shows the last six months as bars. It is private to you, and your CSV/GeoJSON exports include the total and the call.
- Install and offline: on a phone or computer, use the field kit’s **Install Orient** button (or your browser’s install option; on an iPhone, Share then Add to Home Screen) to open Orient like an app. It then opens without a connection: your map, notes and visits are on the device, and the map areas you have viewed are saved for offline use. Live things (sync, Civic data, weather) need a connection and show what they last had.
- Civic tab: the city right now. Weather and alerts, road closures and construction, incidents, state traffic cameras (a live picture when you open one), license plate readers that volunteers have mapped on OpenStreetMap (the data DeFlock maps), and Useful nearby (air quality, fuel context, park amenities). Hover a road, camera or plate reader on a computer for a card; tap on a phone. The layers show on the map while you are on the Civic tab, and the pin beside a switch keeps one on the other tabs too. Where your area has no source, weather and Useful nearby still work.
- Road work: where the area has a source (the Toledo region does), a construction button on the map tools and a line in Today show closures and lane restrictions from the state’s public work-zone feed, refreshed every half hour. It is for awareness, not navigation. Orient downloads one public file and sends nothing about you; turn it off in the field kit.
- Weather: the temperature appears beside the title and opens a report with the forecast, alerts, and how this day looked in past years. The map can show gentle rain, snow or fog to match. It sends only the area’s position, rounded to about 10 km, to Open-Meteo and (in the US) the National Weather Service; turn it off in the field kit and nothing is sent.
- Take your places to other apps: **Your data** in the field kit can save them as **GeoJSON**, **CSV** (opens in a spreadsheet) or **GPX** waypoints. The files are built on your device and leave your neighbor guide out.
- Bring in your own Google Maps data from a Google Takeout export: saved lists (the CSV files in the Saved folder), Saved Places, and optionally Timeline visits. See Importing from Google below.
- Open directions in the maps app you prefer: Apple Maps, Google Maps, Waze or OpenStreetMap, or let Orient choose on a phone. The choice is kept on each device.
- Make short outings ("circuits") from places you've saved, and see them on the map.
- Keep a small calendar of repeating things (a weekly special, a monthly market) and see what's happening today.
- Today’s events and specials also inform outing suggestions, with the specific reason, listed time, and source shown on the recommendation. Timed listings must fit the available outing window; listed today does not mean open now.
- On Explore’s daily start view, use **Get me out for a bit** for up to two small outings based on available time, walking or driving, spending intentions, and people energy. Suggestions run locally and favor saved, unvisited places; ratings of 1–2 are excluded. Travel is estimated, hours and atmosphere are unverified, and dollar budgets are reminders until prices are known. No-spend plans suggest outdoor walks. Preferences last only until the page reloads; the starting point is your chosen home area or a map center you choose, never GPS.
- Look up an address or a business name, and optionally read a place's own website for its hours, phone number and published events.
- Your map is kept in the browser and synced to the computer running Orient, so a phone and a laptop show the same places and visits (see Syncing below). It can also be exported and imported as a file. Fog covers the parts of the map you haven't marked yet.

The feature-by-feature record of how it got here is in [CHANGELOG.md](../CHANGELOG.md).

## Running it

You need Node.js 18 or later. There is nothing to install or build.

```
node server.cjs
```

To keep it running in the background and bring it back after a restart, use Docker instead (`docker compose up -d`; see `docker-compose.yml`). It reads this folder, keeps your data in `./data`, and publishes the port on this computer only.

Then open http://127.0.0.1:4173. On Windows, `.\start.ps1` does the same thing, and `.\start.ps1 -Port 4174` picks another port. The server only listens on this computer unless you set `HOST` yourself.

## Places

A fresh map asks for your home city and starts without the author’s Toledo catalog. The repository includes four fictional sample places in `public/catalog.sample.js` for demo/legacy catalog use; they are labeled as demos and are not real businesses.

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

Private map data syncs only to the computer running Orient and paired browsers. The separate Place commons flow can export a place-note excerpt you explicitly review and approve; it opens GitHub only after you press Open on GitHub to finish. Loading a GitHub commons snapshot requests the public file in your browser only when you ask. Neighbor entries and people fields never enter public bundles.

## How it's put together

- `public/` is the whole app: plain JavaScript and CSS, no build step. `app.js` holds the main flows; the rest are small modules (calendar, circuits, fog, discovery, website reading, and so on).
- `server.cjs` serves `public/` and a few small endpoints for lookups. `geocode.cjs`, `places.cjs` and `website.cjs` hold the bounded, cached requests.
- `ical.cjs` and `public/calendar-dates.js` handle recurrence and time zones. The recurrence engine is adapted from [Lateral](https://github.com/ragingapathy/lateral).
- `public/vendor/` has pinned copies of MapLibre GL JS and Lucide, and the Isometra typeface, each with its license.

## Checks

**To run them all:** `npm test` (same as `node run-checks.cjs`). It starts a test server of its own on a free port with sync off and an empty data folder, runs every `*-check.cjs`, and prints pass, fail and skip. Name some to run just those (`node run-checks.cjs spend icons`), `--list` shows them, `--jobs 3` runs three at a time. It needs Playwright and Chrome (`npm i playwright`, or set `ORIENT_PLAYWRIGHT`). GitHub runs the same command on every push. The older checks share their "get to this screen" steps in `check-helpers.cjs`.

Run `node commons-check.cjs` for protocol validation without browser dependencies. The new `commons-ui-check.cjs`, `areas-check.cjs`, and `briefing-drawer-check.cjs` use `ORIENT_PLAYWRIGHT` (a Playwright module path) or a locally installed `playwright` package, plus Chrome. They default to `http://127.0.0.1:4173`; set `ORIENT_URL` to test another instance. Their browser fixtures block `/api/state` to keep tests separate from the owner’s map.

The `*-check.cjs` files are browser checks written for Playwright and Chrome. They are for my own use and are not a polished test suite. Set `ORIENT_PLAYWRIGHT` to the folder of a Playwright install to run one against a running server. Some checks assume my local catalog and skip themselves without `public/catalog.local.js`. They run in a phone-sized window, so they open the place drawer and its folded rows the way a person would. `npm run check` only checks syntax.

## More setup

### Optional Groq for Gidgit

Choose Groq in Field kit → Gidgit settings after configuring the server. Groq receives only the question you type, never your saved map records or selected-place identity. Anything written into the question itself is sent. Matching, hours checks and edit review stay in Orient. There is no automatic cloud fallback.

Set `GROQ_API_KEY` in the server environment. For Docker Compose, put `GROQ_API_KEY=your-key` in a local `.env` file (ignored by Git), then run `docker compose up -d --force-recreate orient` to apply it. Do not put keys in browser code, map exports, or commits. Native Node deployments must supply the environment variable themselves; Node does not automatically read `.env` here.

The initial model is `openai/gpt-oss-20b`. Free-tier quota failures produce a readable message without switching providers. A selected provider is saved per browser. Cloud edits resolve an explicitly named place locally, or use the selected context when no name is supplied, and always require review before saving.

### Useful nearby and gas reports

The **Civic** tab has a Useful nearby section: Toledo park amenities, preliminary regional AirNow observations, and weekly EIA fuel averages. This uses the chosen area, never GPS. Toledo pins identify the park containing an amenity, not its precise fixture. Access and seasonal availability may differ. Outside Toledo, amenities require another supported source; empty results are not a claim that none exist.

AirNow is fetched from its public reporting-area file, and EIA averages from its official public RSS feed. Users need no API keys. Ohio is explicitly labeled statewide; selected Midwest areas use the regional average. Other areas can configure an appropriate civic publisher. Sources are cached, timestamped, and expired rather than presented as current forever.

A Gas station category gives a place a fuel-report card. Record grade, USD per US gallon, price conditions and observation time. Reports persist with map exports and paired sync. They stay private until Share opens a reviewed commons contribution. Reports are observations, not guaranteed current prices; they are never silently averaged into a city statistic.

City publishers can use `commons-template/civic.config.json` and the Civic data workflow. See [civic data setup](commons-template/CIVIC-DATA.md). Public AirNow publication requires completing its Data Exchange Guidelines requirements; the workflow refuses publication until acknowledged. Toledo park republication remains excluded pending reuse terms. No civic feed is published by merely viewing it in Orient.

## Credits and license

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Basemap by OpenFreeMap. See `public/vendor/` for the MapLibre GL JS, Lucide and Isometra licenses.

Orient is licensed under the [PolyForm Noncommercial License 1.0.0](../LICENSE). You may use and change it for noncommercial purposes.

## Explore start view

Explore opens with a minimized, two-stage daily briefing drawer rather than a selected catalog place. Tap or drag its heading to expand below search or minimize again; the map remains the main starting view on mobile and desktop. Searching shows results; clearing search or tapping Explore returns to the briefing and clears the selected card. Browse the map and Explore as a list remain available. Navigation is Explore, My Map, and Calendar, with an optional fourth Gidgit button. The briefing and agenda update every 30 seconds and when returning to the app, excluding occurrences whose known end has passed. Unknown end times are labeled and historical entries remain in Month view.

## Gidgit local model

Gidgit calls Ollama from the Orient server, so the phone does not need its own model. The defaults are `http://127.0.0.1:11434` outside Docker and `http://host.docker.internal:11434` inside Docker. `ORIENT_GIDGIT_URL` and `ORIENT_GIDGIT_MODEL` select an existing local Ollama service/model; Compose passes these through (recreate the container after changing them). The endpoint accepts only loopback or Docker host addresses and never downloads a model. Ollama must already be running with that model installed. Gidgit uses [structured outputs](https://docs.ollama.com/capabilities/structured-outputs) for a bounded search/edit plan, not free-form map facts.

Only when asked, Gidgit sends the query and saved-place names, categories, notes, listed hours, ratings, and visit status to local Ollama. Dedicated people fields, neighbors, photos, and coordinate fields are omitted. Requests are session-only and are not stored as chat history. Large contexts are bounded; the interface reports when only part of the saved map was read by the model. Recommendations are resolved against saved records by the app, with current opening status and distance calculated locally. Stock, prices, and holiday exceptions are not verified.

Edits show an editable before/after review and require Save. Notes append to existing notes. Invalid place IDs/fields, oversized entries, and stale drafts are rejected; model failure never changes the map. Local or paired-browser authorization is required by `/api/gidgit`. No cloud-provider credentials or fallback are used.

### Hours parser maintenance

Run `node hours-check.cjs` for generated format-equivalence, normalization round-trip, clock-boundary, and rejection checks. Run `node hours-audit.cjs` to audit the current local map and catalog without modifying data or sending requests. Use `node hours-audit.cjs path/to/export.json --details` to inspect unrecognized schedules locally. Do not commit audit output or personal exports. Extend the format corpus when adding a syntax family; keep ambiguous times and date-specific exceptions out of weekly open-now calculations.

### Monthly service hours

Place hours accept `Second Wednesday 9am-11am`, `First and third Tuesday 4pm-6pm`, `Last Friday 8pm-2am`, and mixed weekly/monthly windows. The existing calendar recurrence engine evaluates actual dates in the selected area’s time zone. A recognized monthly service schedule counts as closed outside its listed windows. Missing fifth weekdays are skipped, and overnight windows continue into the following day. Holiday/seasonal exceptions, appointment-only text, and start times without an end still need review.

Monthly service windows appear as derived entries in Calendar and Today (nearby services within 10 miles), with Edit place hours rather than duplicate saved events. Regular weekly business hours do not flood Calendar. Natural-language calendar entry also recognizes ordinal weekdays; the monthly editor exposes a human-readable pattern field. Saved event patterns and hours survive existing backups and sync. Run `node recurring-hours-check.cjs` and `node recurring-hours-ui-check.cjs` for coverage.

## Your map in numbers

On **My Map**, the **Your map so far** drawer (bottom-left on a computer, along the bottom on a phone) opens into what you have been building: places visited and visits logged, your most active day of the week, your regulars, how you explore, what you have added and shared, **A year ago today**, and **Your year in Orient** for each year with visits (with **Copy as text** if you want to share one). It appears when no list or place card is open and remembers whether you left it open.

Everything is worked out in your browser from your own map; nothing is sent anywhere. Weekdays and dates follow your home time zone. The time-of-day pattern uses only visits logged with the check button, since visits added later by date have no time. There are no streaks or goals: it only describes what you did.

## Backups and restore

The map copy this computer keeps for sync (`data/orient-state.json`) is backed up automatically into `data/backups/`:

- **One file per day**, refreshed every hour while the map changes, so today’s copy is never more than an hour old and yesterday’s is the final state of yesterday. Two weeks of days are kept, then the Sunday copies for eight more weeks. Days are UTC.
- **Verified.** A copy is written, read back and checked before it replaces another, and a damaged or empty live map is never copied over a good backup.
- **A safety copy before a large deletion.** If a sync write would shrink the map by more than 40% (a reset, a sync mistake), the map as it was is saved first as `orient-state-before-change-…json`. At most one an hour; the newest five are kept.
- **Your field kit → Backups** (on this computer only) shows the last good backup, can **Back up now**, and lists every copy.

To go back to an earlier copy:

```
node restore-backup.cjs                 # list the copies
node restore-backup.cjs 2026-10-10      # restore that day (or --latest)
docker compose restart                  # so Orient reads the restored file
```

The restore saves the map as it is now first (`before-restore`), checks the chosen copy, and writes it with a newer revision. Phones and other browsers then follow it, and anything added after that copy was made is removed from them as well, because restoring means going back. Export in Your field kit first if you want to keep something from now. Backups are not encrypted and sit beside the live copy, so they are only as private as that folder: if `data/` is inside a cloud-synced folder such as OneDrive, so are they. Browsers keep their own copies as well, and **Export my map** still makes a file you can keep anywhere.

## Project stats

`node repo-stats.cjs` records GitHub’s traffic numbers (clones, page views, stars, forks) for the project’s repositories into `data/repo-stats.json`, which Your field kit shows as **Project stats** on the computer that runs Orient and nowhere else. GitHub keeps only 14 days and shows them only to the repository owner, so run the script at least every two weeks to keep a history. On Windows, `.schedule-repo-stats.ps1` installs a weekly task (Sundays 09:00, hidden, runs at the next opportunity if the computer was off; `-Day` and `-At` change the time, `-Remove` takes it away) and `data
epo-stats-last-run.txt` shows the latest run’s output. It uses `GITHUB_TOKEN` or the GitHub login git already has, and never prints or saves it. Set `ORIENT_STATS_REPOS=owner/a,owner/b` to choose the repositories. Clone counts include bots, mirrors and your own machines: a rough signal, not a head count. Orient itself does not report who uses it.

## Place commons

An explicit, reviewed place-note contribution and commons-bundle import/export loop is available in Field kit. See [commons/README.md](../commons/README.md) for the GitHub workflow, public format, and privacy boundaries. Sharing opens GitHub’s own new-file page with the reviewed file filled in, so no token is needed; publishing from Orient with a token is an optional extra. Neighbor entries never participate.

## Collections

Open Your collections from My Map’s map tool or list. Create a name and optional description, then add saved places. A place card’s Add to / edit collections supports multiple memberships and creating a collection in place. Collections are unordered and private. Show on map fits the member pins; Show as list applies the collection filter. All my places clears it. Removing a member or deleting a collection preserves the underlying places and visits. Make a circuit lets you choose 2–12 members and review their order in the existing circuit editor; changes to that circuit do not change collection membership. Collections are included in private backups and sync and never automatically exported to the commons.


## Your city, unfolding

Open **My Map → Your city, unfolding → Explore your milestones**. Twenty milestones reward adding places, exploring different kinds of places, return visits, collections, circuits, and a sourced local fact. Each pays once; there are no streaks or deadlines. Existing progress counts. Circuits still unlock after five lifetime points and four real places. Spending points on stories does not lock them again.

**Nearby** shows stories within 30 km of your current starting area. Curated coverage currently includes Toledo, Michigan landmarks, Chicago, and Kansas City. Each curated story costs two points to reveal, includes a source, and stays in **My discoveries**. Showing a pin never logs a visit. Areas without curated stories invite local contributions instead.

Use **Leave a local fact** here or on an expanded place card. Add a short title, fact, and landmark; choose a saved place, use the map center, or adjust coordinates. A public HTTPS source and a credit handle are optional. Unsourced facts are labeled personal observations. Your facts are free to read, have map pins, and can be edited or deleted. Up to 100 facts are included in your map backup and map sync.

**Review sharing** asks you to confirm that the fact concerns a public place, contains no personal information, and that you can share your wording under CC BY 4.0. The next screen previews the exact Commons file for copying, downloading, or proposing to a city repository. Nothing publishes automatically; a repository maintainer reviews proposals. The file contains only the chosen fact, landmark and pin, source, date, and chosen credit. Deleting your local fact does not withdraw copies you already shared. Accepted Commons history claims appear under **Local contributions** and can be read without spending points; disputed claims carry a label.


Spending and confirmed Local/Chain classifications keep a discovered place on **My Map**, even if you remove its bookmark. Un-saving does not erase its ledger. A failed save reports an error and restores the previous values. **Spending → Share business type** prepares a reviewed public Commons/GitHub observation of the classification only; your purchase amounts and private notes are excluded. Publication remains an explicit action.


## Share everything together

**Settings → Sharing → Share** gathers all your place notes, Local/Chain business classifications, and local facts. Everything starts selected; review the text and uncheck anything you want to keep private. Long notes are split into multiple observations without losing text. Choose the city commons repository, confirm the selected text is appropriate for public sharing under CC BY 4.0, then press **Share**. One request submits one contribution for maintainer review.

GitHub must be connected once before sending; use the connection form on the same screen. The repository is remembered for next time. Personal purchase amounts, people fields, contact records, galleries, and calendar entries are excluded. Text you wrote inside a selected place note is included, so review notes that mention people. Originals stay unchanged. If sending fails, your selection remains ready for retry. Each contribution supports up to 500 observations across 200 places.


## Correcting a special

Edit **People & notes → Your note** and save. Weekday schedules such as `Sun: 1/2 price wings, $6 PB&J sandwich. Mon: $6 burgers.` are recognized from the current note and replace the catalog schedule for your map. The place card, specials search/filter, Today and Calendar all use this same updated schedule, including after reload. Half-price wording is preserved rather than converted into a fixed dollar price.

Use **Edit place note** on a recognized calendar special to correct it. Clearing the schedule or marking specials discontinued removes those derived listings; separately created calendar entries remain yours to edit independently. Note corrections remain private unless you explicitly share them.

Calendar entries now share a **Manage** button explaining their origin. Personal entries support editing and deletion; recurring series can skip a single date. Specials route to private place-note corrections, while website entries route to import management. Original sources remain unchanged and linked.

Use **Edit place details** on any place card to correct its address, including imported places. The private correction persists in backups and takes precedence over website addresses. Use Find matching pin to move it, or explicitly keep the current pin for a text-only correction.

### Address and pin consistency
Place details now offers **Find matching pin**. Select an address match to update both the address and map pin, or explicitly keep the pin for text-only corrections. Pin corrections survive reload, sync, and backups, and existing markers move immediately. Corrected the local Bier Stube catalog pin, which was about 695 metres from the numbered address. Audited ten locations using Census address estimates and Toledo municipal GIS; the audit is in output/location-audit/2026-10-11.json. Address estimates are not verified storefront entrances.

### Capture a point on the map
Hold one finger on the map for about 0.6 seconds, or right-click on desktop, to choose Photo, Note, Photo + note, or New location. Panning and pinching cancel the hold. The coordinate is captured at the start of the hold and stays selected even if an uploaded photo has different GPS metadata. The add menu now says Photo or note, and notes can be saved independently, edited, synced, and backed up without an image.
