# Orient Changelog

## 2026-10-11 — Where your money goes

- **Spending, on the place card.** Expand a place and open **Spending**: write down what you spent and on which day, and Orient keeps the total, the average and the last day for that place. It stays private on your device (and your own sync), like visits.
- **Local or chain, your call.** Each place has a **Local** / **Chain** switch. Orient only hints (a dashed Chain button when the name is a well-known chain); nothing is counted until you choose, and a second tap clears it.
- **Where your money goes, on My Map.** Once you have written something down, My Map shows how much of what you sorted stayed local, a split bar (local, chain or corporate, not sorted yet), and the places you spent the most at, for 30 days, 12 months or all time. Money at places you have not sorted is shown apart, never hidden inside either side.
- **Add spend** appears beside Undo after you log a visit, and opens the Spending section with the amount box ready.
- Your CSV and GeoJSON exports gain `spent` and `ownership` columns; the full map export, backups and sync carry the records (entries merge between devices). Spending is never read by the commons or the insights.
- New check `spend-check.cjs` (14 cases).

## 2026-10-11 — Orient is an app

- **Install it.** Orient now has a web app manifest, proper icons (standard, maskable and Apple) and a service worker, so a phone or computer can add it to the home screen or desktop and open it full screen like an app. Where the browser offers it, the field kit has an **Install Orient** button; on an iPhone it says to use Share, then Add to Home Screen. Installed, the field kit says so.
- **It opens without a connection.** The first visit saves the app's own files on the device, and each time you are online the newest copy replaces them (the newest file always wins; the saved copy is only a fallback). Offline, your map, notes, visits and Calendar are right where you left them, since they were always stored on the device. Map areas you have looked at are kept too (up to 700 tiles, public map data only), so the places you know still draw without a signal.
- **Private things are never kept.** The service worker never touches `/api/` (your synced map, backups, sharing, Gidgit and anything live), and it ignores every other site except the map's tile server. Anything you ask for live is asked for live.
- Needs an https address (or localhost); over plain http, such as a bare Tailscale address, the app works as before without offline support, and the field kit says so.
- New check `pwa-check.cjs` (8 cases) and `make-icons.cjs` to redraw the icons.

## 2026-10-11 — The Civic tab

- **Civic is a tab of its own**, just before Gidgit (which stays last): the city right now, on one screen. A strip of tiles (weather and alerts, roads closed nearby, incidents, license plate readers within 5 miles) jumps to its section: weather and alerts, road work, incidents, state traffic cameras, license plate readers, and **Useful nearby** (air quality, fuel context and park amenities). The "Useful nearby" button that sat in the header, and its modal, are folded in here and gone from the header.
- **Layers on the map.** Incidents, traffic cameras and plate readers draw on the map with their own icons, clusters at city scale, and a facing arrow on each plate reader. Every layer is on while you are on the Civic tab; elsewhere only the ones you chose to keep (the pin beside each switch).
- **Hover cards** on a road, incident, camera or plate reader (desktop): the closure and its dates, a camera's current picture, and for a plate reader who runs it, what make it is and which way it faces, with its field of view drawn on the map. On a phone a tap opens the same detail.
- **Cameras.** Ohio's traffic cameras (86 in the Toledo region) open as a live picture that refreshes every few seconds, straight from ODOT's own server, only when you open one.
- **License plate readers** come from what volunteers have mapped on OpenStreetMap, the data DeFlock maps: 591 in the Toledo region today. The Civic tab counts them near you by operator and make, says plainly what they are, and credits OpenStreetMap (ODbL) and DeFlock.
- **Data pipeline.** The commons repository's scheduled "Live city data" workflow (`commons-template/`, every half hour; plate readers daily) reads OHGO with the maintainer's key and OpenStreetMap, and publishes `roadwork.json`, `incidents.json`, `cameras.json` and `alpr.json` on a `live-data` branch. Orient downloads those files; nothing about you is sent. A source that fails keeps its last good data for a while.
- **Closures** is also a filter chip in Explore (beside Specials and Open now): it opens the closures list and shows only closures and incidents on the map until you pick another filter or leave Explore.
- Typing in the search bar or choosing a park from Useful nearby takes you back to Explore.
- New checks: `civic-board-check.cjs` (14 browser cases), `live-data-check.cjs` (7 offline cases), and the road-work and civic checks updated for the new names.

## 2026-10-11 — Road work and closures

- **What is under construction, and which roads are closed**, drawn on the map (closures solid red, lane restrictions dashed orange, work starting soon faded, lanes-open work grey-green, each start marked with a dot) and listed under a new construction button on the map tools. Tapping a road on the map opens its card first; *Show* on a card zooms to it.
- **Today** gets a line such as "2 roads closed · 2 lane restrictions" when there is something within about 15 miles, and the list says plainly when its information is old.
- **It reads the US national standard, WZDx**, so any state's feed fits. A scheduled GitHub Action in a commons repository (`commons-template/.github/workflows/roadwork.yml`, every half hour) reads the feeds listed in `roadwork.config.json` with the maintainer's own API key (a repository secret, never published), keeps only the region, and publishes one small `roadwork.json` on a `roadwork-data` branch (one replaced commit, so history does not grow). Orient downloads that one public file: no key for readers, no location sent. If a feed fails its last good copy is kept for six hours, then dropped.
- Ohio's OHGO feed is configured for the Toledo region; Michigan or any other WZDx feed is one more entry in the config (see `commons-template/README.md`).
- **Switch** in the field kit ("Road work on the map"); when no source covers the area it is off and says so.
- New checks: `wzdx-check.cjs` (8 cases: the reader, the fetch tool, the key handling, the workflow) and `roadwork-check.cjs` (13 cases in the browser).

## 2026-10-11 — Weather

- **The temperature and a weather icon sit beside FIELD TEST** in the header. Tap it for the weather report: now, the next 24 hours, the week, wind, humidity, UV, sunrise and sunset, and any National Weather Service alert (US) with what to do.
- **How this day looked in other years:** the same date 1, 2, 5, 10, 20, 30, 50 and 75 years ago (as far back as 1940), each compared with today, plus what is usual for the week around this date (1991–2020 average, records, and where today's forecast high ranks) with a small chart.
- **The map has weather.** Gentle rain, snow, fog, drifting cloud shade and a soft, slow flash of lightning drift over the map, matching the real conditions. It never takes a tap, stops entirely under reduced motion, and can be switched off. A preview in the report shows every kind on a sunny day.
- **Today** gets a one-line weather summary with the outlook ("Rain likely around 3 pm") that opens the report.
- **Privacy:** the only thing sent is the area's position rounded to about 10 km, to Open-Meteo (forecast and history, no key) and, in the US, the National Weather Service (alerts). Nothing from your map is ever included. Switch Weather off in the field kit and no request is made. Units follow the area (°F and mph in the US) and can be flipped in the report.
- **Weather shapes the suggestions.** "Get me out for a bit" moves outdoor places down in rain, snow, storms, extreme heat or cold and strong wind, brings indoor ones up (with a short note on each card saying why), favours parks on a lovely day, and never suggests going outside during a severe or extreme NWS alert. Today's "Still on your list" leans the same way. It only reorders: nothing is hidden except outdoors during a severe alert. With Weather off, nothing changes.
- A coffee shop now counts as somewhere to pause rather than to browse in outing suggestions.
- New check `weather-recs-check.cjs` (6 cases); mocks are shared in `weather-mock.cjs`.
- New check `weather-check.cjs` (13 cases, all answered by mocks) and shared files `weather.js`, `weather-fx.js`, `weather.css`.

## 2026-10-11 — The panels join in

- **Collections and the Add form** follow the shared dialog shell: icon tile, title, switches, cards. Codex’s separate `modal-system.css` and the supplied `gidgit.png` are retired in favour of `ui.css` and the pixel mascot (Gidgit is being reworked separately).
- **Explore, My Map and the place card** use the same language: place rows as cards, My Map blocks as cards with tag chips, an orange saved tile and a green visited tile on the place card, facts as pills, folds as cards, a green gradient on the daily outing.
- **Milestones and local lore** get an icon, a gradient balance tile, chip tabs and rounded progress bars.
- **Dialog details:** form labels read the same everywhere, disclosures use one arrow, the weekday picker in a calendar entry is a row of chips, and the calendar-entry dialog has its icon.
- **Filters, list filters and the neighbor card** are restyled; a brand-new My Map now leads with *Add your own place* before collections and circuits.
- **Export for other apps:** Your data gains **GeoJSON**, **CSV** and **GPX** buttons, built on the device from the saved map (the neighbor guide is never included; spreadsheet formulas are defused). New check `export-open-check.cjs` (6 cases).
- `ui-check.cjs` now has 13 cases and guards the panels, including a regression where the Create a collection button turned white on white.

## 2026-10-11 — One design language

- **A shared visual language**, taken from Your map so far, now carries the rest of the app (`ui.css`, `ui.js`, `mascot.js`, written up in `docs/design-language.md`): soft cards, uppercase kickers, tinted icon tiles, gradient hero tiles, switches instead of tick boxes, one warm accent, a gentle rise, and no motion under reduced-motion settings.
- **Every dialog** now shares one shell, and dialogs made in JavaScript inherit it: an icon tile, a title, a close button, the same button hierarchy and the same fields.
- **The Field kit is rebuilt** as grouped cards with a jump bar: Your map (home, fog, demo places, directions), Devices & backups (sync and backups with a status dot), Sharing, Gidgit, Your data (export, import and Google import as tiles, reset as a quiet danger row) and About & privacy. Every id, data attribute and button name is unchanged.
- **The Calendar tab** leads with three numbers (today, this week, next 90 days), the next seven days as a strip that jumps to a day, a quick-add card, an Agenda | Month switch, colour-coded entries by kind with Today and Tomorrow named, shaded busier days in the month view, and an inviting empty state with starter ideas.
- **Gidgit has a face.** A small pixel mascot in five expressions (idle, blinking, thinking, happy, confused) appears in the Gidgit dialog, on the nav button and in the Field kit. Its mood and its speech-bubble line follow what the dialog is really doing: thinking while it works, happy when it has an answer, confused when something fails. Starter ideas fill the question box. The `gidgit.png` override that was planned is gone.
- Decorative text drawn by CSS is marked with empty alternative text so it is not read as part of a button’s name.
- New check `ui-check.cjs` (12 cases: the Field kit and its jump bar, switches, every dialog’s header, the calendar, Gidgit’s moods and faces, the nav button, phone layout, reduced motion).

## 2026-10-10 — Gidgit gets a face

- Add the supplied transparent Gidgit character beside the assistant modal title, sized for mobile and desktop. Animation remains planned for a later pass.

## 2026-10-11 — Your map in numbers

- **A retractable drawer on My Map**, in the spot where Explore keeps Today: **Your map so far**, closed by default with a one-line summary ("10 places visited · 3 visits this week"). It steps aside when the list or a place card is open, remembers whether you left it open, and works on a phone as a bottom drawer.
- **Four big numbers**: places visited, visits logged, saved places still to try, and observations shared with a commons.
- **A year ago today**: the same date in earlier years ("A year ago you went to the comic shop"), or the same few days if that exact day was empty.
- **Your rhythm**: your most active day of the week as a bar chart, this week and the last 30 days, your best week, the time of day you tend to go (from visits logged with a tap), and the last twelve weeks as a grid of days.
- **Your regulars**: your five most-visited places with visit counts, stars and the last visit, plus the places you rated five stars.
- **How you explore**: the share of your saved places you have visited, new places versus places you went back to, new places by month, and where your visits go by kind of place.
- **What you are building**: places added, notes written, places rated, photos kept, circuits made, calendar entries, places shared with a commons, and milestones earned.
- **Your year in Orient**: a summary for each year with visits (places, new places, most-visited place, busiest month, favourite day, how the year began), with **Copy as text** to share it on your own terms.
- Worked out in the browser from your own map. Nothing is sent anywhere, and there are no streaks or targets: it describes what you did and never scolds. Dates follow your home time zone.
- Nothing in `app.js` changed: the drawer is a separate file that reads the saved map and mounts itself on My Map. Damaged or old data in storage cannot break it.
- New check `insights-check.cjs` (19 cases: time zones, ties, new versus returning, once-only counting, leap days, the year review, junk data, the drawer's show/hide rules, refresh, reduced motion, a phone, and that nothing leaves the page).

## 2026-10-10 — A shared atlas style for modals

- Align Collections, Settings, Circuits, Add place, and Place details with the compact icon headings, bordered cards, sage controls, and orange section labels from Your map so far.
- Group settings and place fields by purpose; tuck detailed data-source explanations into a disclosure.
- Preserve existing actions and form behavior, with gentle entrance motion and reduced-motion support.
- Verify collection flows, Settings at 320px/390px/desktop widths, add-place fields, and place-detail saving with fictional data.

## 2026-10-10 — Private collections

- Add named, unordered collections with optional descriptions in My Map and place cards. A place may belong to several collections.
- Show a collection on the map or filter My Map list; preserve places and visits when removing membership or deleting a collection.
- Choose 2–12 members to seed a circuit, then review/reorder stops independently of the collection.
- Validate membership references and text limits, retain collections in private sync/backups, and keep collections outside public commons bundles.
- Browser checks cover creation, multiple membership, map/list filtering, circuit conversion, reload, deletion, private-data preservation, and narrow screens.

## 2026-10-11 — Automatic backups of the synced map

- The computer running Orient now backs up the one copy phones sync against (`data/orient-state.json`) into `data/backups/`. One file per day, refreshed hourly while the map changes; two weeks of days kept, then Sundays for eight weeks. Every copy is written, read back and checked before it replaces another, and an empty or damaged live map is never copied over a good backup.
- **A safety copy before a large deletion.** A sync write that would cut the map by more than 40% (for example **Reset this browser’s map**, which syncs as a deletion) first saves the map as it was. One an hour at most; the newest five are kept.
- **Your field kit → Backups**, on this computer only: last good backup, **Back up now**, and the list of copies. Through the public address the server refuses it.
- `restore-backup.cjs` lists copies and restores one: it saves the current map first, checks the copy, writes it with a newer revision, and reminds you to `docker compose restart`. Devices follow the restored map, including its removals.
- New check `backup-check.cjs` (8 cases: verification, rotation over 60 simulated days, the shrink guard through the real sync endpoint, restore, trust rules, the panel). Needs a server restart.

## 2026-10-11 — Names on the map, and a hover card

- **Pins now carry the place’s name**, not its category (the selected pin used to show “Public space”). From a close zoom, names appear in order of how much a place matters to you: the selected place, then visited, saved, your own and catalogue places, then the rest. A name is skipped if it would sit on another name or on another pin, so a busy street stays readable. Zoomed out, the map is not covered in text.
- **Hover card on desktop.** Hovering a pin (or focusing it with the keyboard) shows a small card: name, type, open or closed now from the hours Orient has parsed, address, and your visits (“Been here 2 times · last today”). It stays inside the map, never blocks the pin underneath, and Escape dismisses it. Touch screens get names but no hover card, since there is no hover.
- New check `map-labels-check.cjs`: label content, a geometric guarantee that no name overlaps another name or pin, zoom gating, the selected place always named, hover and Escape behaviour, and a touch device.

## 2026-10-11 — Filled in for you, and clone counts

- **Prefill.** When the home city is within 60 miles of Toledo, **Share this note** fills in `ragingapathy/toledo-commons` as the destination (a destination you chose before still wins), and **Place commons** fills in the Toledo snapshot address to follow. Elsewhere nothing is filled in.
- **Project stats.** `repo-stats.cjs` records GitHub’s clone and view counts, stars and forks for the project’s repositories into `data/repo-stats.json` (GitHub keeps only 14 days, so the archive is what builds history). Your field kit shows them as **Project stats**, only on the computer that runs Orient: the endpoint refuses anything that looks like it came through the tunnel. These are GitHub’s numbers about repositories, not about people using the app, which still reports nothing.
- `schedule-repo-stats.ps1` installs (or removes) a weekly Windows scheduled task for it: hidden, runs only while you are signed in, catches up after a missed run, and leaves its output in `data/repo-stats-last-run.txt`. Verified by running it through Task Scheduler. (A first attempt that hid the window with `conhost --headless` silently did nothing; a hidden PowerShell is what works.)
- New check `repo-stats-check.cjs` (merge logic, a fake GitHub, the endpoint’s trust rules, and the panel). `commons-open-check.cjs` covers the prefill.

## 2026-10-11 — The Toledo commons is live

- [ragingapathy/toledo-commons](https://github.com/ragingapathy/toledo-commons) is the first commons, made from the template, with its own reader-facing README and the maintainer notes in `MAINTAINING.md`.
- The template’s workflows were run for real on GitHub, in a private scratch repository: a valid contribution passed its check; a pull request that edited the validator and added a private-map export failed with the two errors on the right files; merging rebuilt `snapshot.json`; and a retiring contribution drew the “would be replaced” warning, then showed as retired in the snapshot.
- Workflows now use `actions/checkout@v7` and `actions/setup-node@v7` (v4 ran on a deprecated Node version). Setup instructions no longer ask maintainers to change the repository’s workflow permissions: the workflows declare what they need, and that was verified.

## 2026-10-11 — A template for hosting a commons

- **`commons-template/`**: a repository to copy for the maintainer side of the place commons. A **Check contribution** workflow runs on every pull request that touches `contributions/` and fails anything that is not a valid, append-only public bundle. It posts a table of the place, a map link for the pin and the full observation, and warns about emails, phone numbers, likely references to a person, replaced observations and moved pins. A **Build snapshot** workflow rewrites `snapshot.json` when a contribution is merged, so followers need only one address.
- The checking code runs from the base branch, with read-only access and no secrets, so a contribution (including one from a fork) cannot loosen the rules it is checked against. Tested with a pull request that gutted its own validator.
- Merging follows the protocol: later contributions correct or retire earlier ones, ordered by when they reached the repository’s history, and separate commons stay separate. A commons beyond Orient’s per-file limits is split into `snapshot.json`, `snapshot-2.json`, and so on, each one valid for Orient. Builds are deterministic.
- The pull request text from the token route now says what happens in a repository that uses the template (restart the server to pick this up).
- New check `commons-template-check.cjs` (16 offline cases, using throwaway git repositories). The workflows themselves have not run on GitHub yet.

## 2026-10-11 — Share a note without a GitHub token

- **No token needed.** After the preview, **Open on GitHub to finish** opens GitHub’s own new-file page with `contributions/<hash>.json` filled in. You sign in as yourself and press Propose new file, then Create pull request; GitHub makes the fork. Orient never handles a GitHub credential on this route. The file name and content match what the token route creates, so the two never disagree.
- **Two-field form.** Sharing now asks for the observation and a consent tick. Place name, map pin, type, date and commons identity are filled in and tucked under **Details**. The “Kind” list uses plain names (Getting in, Browsing, Seating & staying…).
- **Plain-language preview.** What will be shared appears as a quote, place and date. The exact JSON is one tap away under **Show the file that will be shared**.
- **Repository check.** The repository is checked with GitHub’s public API as you type (not found, private or archived are explained) and a pasted GitHub link is accepted. **Copy the file** is there for very long contributions, which do not fit in a link.
- The token route remains, folded under **Other ways to share**, with Download.
- New check `commons-open-check.cjs`; the commons UI checks follow the new layout. Not yet tried against the real GitHub page: that GitHub prefills the editor from the link is documented behaviour but unconfirmed here.

## Reviewed GitHub publishing

- Replace the download-only contribution endpoint with Publish contribution: select a commons repository, connect GitHub once, review the public bundle, and submit a pull request from Orient.
- Create a dedicated branch and contribution file, fork when needed, and reuse existing requests on identical retries. Nothing is directly merged.
- Store per-browser GitHub connections encrypted on the Orient computer, outside private map backups and public bundles; retain optional file download.
- Validate public payloads again on the server; require local/paired access; add endpoint, mocked GitHub, and browser checks.

## 2026-10-09 — v0.7.0: Explore starts with possibilities

- Open Explore with the daily briefing, remaining specials, nearby service hours and saved/unvisited suggestions. Startup never selects an arbitrary catalog place.
- Search replaces the briefing with matching results; clearing search or tapping Explore returns to the briefing. Browse the map and Explore as a list remain explicit choices.
- Remove the redundant Today navigation tab. Three primary tabs remain: Explore, My Map and Calendar; optional Gidgit becomes a fourth button.
- Includes local Gidgit settings and grounded hours answers, expanded hours format coverage, monthly service recurrence shared with Calendar, and automatic expiry of finished agenda entries.


## 2026-10-09 — Gidgit, an optional local map companion

- Added a per-device Field kit opt-in. Gidgit appears as a fifth navigation button only when enabled; no model requests run until the user asks.
- Saved-map queries use a local Ollama model (qwen3.5:9b by default), with structured search/edit plans. The app grounds suggestions in saved records and computes hours/distance itself. There is no cloud fallback or invented inventory/price claim.
- Supports editable, reviewed hours, note, and category drafts. Saving is explicit, notes append, and stale/invalid drafts are blocked. Requests do not become stored chat history.
- Excludes dedicated people fields, neighbors, photos and coordinate fields from model context. Bounds context and inference time; reports partial context, connection failures, cancellation, and pairing requirements. The server requires the same local/paired authorization as map sync.
- Verified disabled visibility and zero automatic requests, mobile/desktop drawer, saved-map shopping recommendations, private context boundary, map navigation, save/discard and preference persistence. Ran the complete browser workflow against the actual local model and verified live paired/unpaired API behavior.

## 2026-10-09 — Weekly hours and a city lit by open places

- Added local hours parsing with live feedback in the Hours editor. Recognized schedules save in a uniform weekly format; ambiguous and unsupported text stays intact for review and never counts as open. Supports days-first and time-first wording (including 8AM-2AM Daily and 11AM - 8PM DAILY), day ranges, split shifts, overnight spans, 24-hour days, closed days, and home-area time zones. Unlisted days remain unknown.
- Place cards show current open/closed status from personal, website, or map hours. The existing Open now filter now uses parsed schedules instead of a static flag.
- The existing Open now filter activates night mode: a dark city with warm lights around places open by listed hours. Unknown schedules are excluded and counted; holiday exceptions remain unverified. The view refreshes every 30 seconds and handles zero open places without covering the map.
- Strengthened fog contrast and curl movement, kept canvas work capped, and retained reduced-motion and pause behavior.
- Verified parser boundaries, overnight and split shifts, ambiguous input, time zones/DST, mobile/desktop visuals, editing and reload, moving fog and reduced motion, plus automatic closing-time updates.

## 2026-10-09 — v0.6.0: Make Orient yours, wherever you live

- Added first-run city/town search and confirmation, with home area controls in the Field kit. GPS and a home address are unnecessary.
- The home area centers the map, biases place searches, and supplies Explore distances and Today/outing origins. Changing it keeps saved places. Calendar and website/feed imports use the selected time zone, initially the device setting.
- Fresh maps start without the Toledo catalog and can request nearby open-map discoveries at their city center. Existing maps migrate to Toledo and retain catalog references; backups and sync include the new settings. Unrevealed curated lore appears only near its location.
- Verified mobile setup, Michigan discovery, persistence, changing cities/time zones, legacy migration, Add and outing flows, address geocoding, website import time zones, and live Ann Arbor city-only search.

## 2026-10-09 — A simpler Add menu

- Add now begins with two choices: **Photo + note** or **Name of place**. The full address, website, category, neighbor, coordinates, and notes offerings appear only after choosing Name of place.
- Back returns to the two choices without discarding entered fields. Opening Add afresh resets the flow; editing an existing place opens directly in the form.
- Verified both photo and named-place paths, back navigation, save/edit behavior, and narrow mobile layout.

## 2026-10-09 — Photo + note, without the place form

- Added **Photo + note** directly to the Add place menu. A geotagged photo can create its own map pin with only an optional note; no name, category, or address fields are required. A short display title is derived from the note, with Photo memory as the fallback.
- Standalone photo pins use the image’s GPS by default, even beside a known place. Existing-place attachment is an optional disclosure. Without readable GPS, saving requires an explicit map-center choice or an existing place.
- Photo memories open with the image and its note at the top of the card. Their camera category and photo-memory state survive reload, sync, and backups.
- Verified the add-menu flow, GPS pin creation, empty-note fallback, no accidental attachment, optional attachment, explicit map-center placement, primary photo card, reload, and existing photo/GPS regression checks.

## 2026-10-09 — Place a photo using its GPS

- Photo uploads now read embedded coordinates locally before resizing. Nearby known places appear in a destination picker; a single clear close match is preselected for review, while ambiguous matches require a choice. The existing place can always be overridden.
- **Add a place photo** in the My Map list can start with an image. Users can attach it to an existing place or create a named personal place at its coordinates. Photos without readable GPS retain manual place selection.
- Coordinates are used locally, with no external lookup. The smaller saved image strips embedded metadata. GPS does not establish which business was photographed; the selected destination stays visible before save.
- Verified real synthetic EXIF parsing, coordinate order, close/ambiguous matching, new-place creation, no-GPS fallback, saved metadata removal, mobile layout, and the existing photo workflow.

## 2026-10-09 — Photo memories for places

- Added **Photos & notes** to every expanded place card, with a thumbnail gallery, camera/file selection, individual editable photo notes, and removal. Works for personal places and public spaces as well as businesses.
- Images are resized and re-encoded locally as JPEGs before saving; originals are untouched. Photos travel with map sync and JSON backups. Import size increased from 2 MB to 3 MB to match the sync request limit.
- Bounded album storage keeps this first version within browser storage limits. Capacity/save errors retain the editor and existing photos; concurrent photo additions are preserved through sync merges.
- Verified resizing, safe note rendering, edit/remove/reload, rating independence, JSON backup/import, sync merges, and mobile presentation.

## 2026-10-09 — Get me out for a bit

- Connected outing suggestions to Today’s recurring calendar entries, website events, and shared specials. Relevant listings boost a place and appear on its suggestion with the title, time, provenance, and source link. Timed listings must fit the estimated travel, waiting, and short visit; expired entries are excluded. No-spend walks stay separate from offers with unknown costs, and ordinary suggestions remain available.
- Today now offers a small outing planner: time to spare, walking or driving, spending limit, and people energy. Up to two suggestions explain why they were chosen, with place cards and directions in the preferred maps app.
- Suggestions favor saved, unvisited places, exclude low personal ratings and service/resource categories, and use a rough round-trip travel allowance plus a 20-minute stop. No-spend plans suggest outdoor walks; other spending limits are reminders because prices are unknown. Hours, access, and atmosphere are explicitly unverified.
- Preferences are temporary and local. The origin is clearly labeled and can be changed to the current map center. No GPS, external recommendation service, or changes to saved-map data.
- Preserved the eight exploration ideas in Craft under **Orient — Exploration ideas**. This is the first implementation; the other ideas remain proposals.
- Checked constraint/ranking behavior, mobile and desktop layouts, directions, place navigation, session-only preferences, and the existing Today briefing.

## 2026-10-11 — A simpler place card, and Directions that ask once

- **Simpler card.** Closed, the card is the name, the save and visit buttons, and one line about visits. Opened, it adds the rating, the address, hours and phone (their captions are gone; the icons say it), one **Directions** button, and the folded rows. The “Saved on your private map” and “Discovered nearby” lines are gone (the bookmark already says it), the “Less detail” bar moved to the foot, **Edit place** and **Remove** are quiet text buttons instead of two big bars, and the fine print is left to Your field kit.
- **Directions ask once.** The first time you tap Directions on a device, Orient asks which maps app you use (Apple Maps, Google Maps, Waze, OpenStreetMap), opens it, and remembers; it can be changed in Your field kit. Android skips the question, because a `geo:` link lets the phone use its own default.
- “Been here 2 times · last Today” now reads “last today”. Rating label no longer wraps on a phone.

## 2026-10-10 — Bring your Google Maps places with you

- **Import from Google** in Your field kit reads a Google Takeout export in the browser: saved lists (CSV), `Saved Places.json`, and optionally Timeline visits. It shows each list and what it found, and adds the places you tick as saved places, with the note and a guessed category. Places already on your map are skipped, so a second import adds nothing.
- Saved-list exports often carry only a name and a link. **Look up by name** (up to 80 at a time, one per second) sends only the name and your home city to the local reader and lists the matches for you to check; matches more than 60 miles from your map stay out unless you include them.
- **Timeline** visits are added as dated visits only for places already on your map (within about 75 metres, one per place per day); the rest of the file is discarded unread. Files over 200 MB are refused.
- New checks: `takeout-parse-check.cjs` (offline, 6 cases) and `takeout-check.cjs` (browser, with made-up files). Not yet tried on a real export.

## 2026-10-10 — Directions in your maps app, and a service that stays up

- **Directions** now opens the maps app you choose instead of always Google Maps: Apple Maps, Google Maps, Waze or OpenStreetMap. A web page can’t see your default app, so there is a **Directions open in** setting in Your field kit, kept on that device. *Automatic* picks Apple Maps on iPhone and iPad, a plain `geo:` link on Android (so the phone uses its own default), and Google Maps elsewhere. Circuits use the same choice, with walking or driving routes where the app supports it.
- `docker-compose.yml` runs Orient as a background service that restarts on its own, like the other services here. It reads this folder, keeps data in `./data`, and publishes the port on `127.0.0.1` only. `ORIENT_TRUST_LOCAL_HOST=1` lets the sync endpoints treat connections from this computer as trusted when they arrive through Docker; requests that came through a tunnel are still recognised and refused without the pairing key.
- New check: `directions-check.cjs`.

## 2026-10-10 — One map on every device

- The phone and the desktop now share one map. The computer running Orient keeps a single copy (`data/orient-state.json`); each browser keeps its own too, so it still works with no connection, and syncs when it can: when you open or return to Orient, a minute after a change, and on a timer.
- Changes from two devices are **merged**, not overwritten. Visits logged on both are kept; a place saved on one and a rating given on the other both survive; a visit or place you removed stays removed. A first connection combines the two maps and takes the server's settings.
- **Pairing:** the computer you run Orient on is trusted. A phone (or anything coming in through the tunnel) must carry a secret key, made on first use and shown only on that computer under Your field kit → **Pair a phone**, as a link to open once on the phone. **Make a new key** disconnects every phone.
- New checks: `sync-merge-check.cjs` (offline, 11 merge cases) and `sync-check.cjs` (a trusted desktop and a paired phone through a separate hostname: seeding, refusal without the key, pairing, a visit crossing over, simultaneous edits, offline, and a new key).
- Needs a restart of the Orient server. Export and import still work as a backup.

## 2026-10-09 — A calmer place card

- The expanded place card used to be one long stack of equal sections. Now the essentials stay up top (name, save, visit, rating, address, hours, phone, Directions) and the rest folds into quiet rows: **Your visits**, **People & notes**, **What’s happening**, **Near this place**, and **Website & calendars**. Open rows stay open as you move around. A website read that has findings to review, or is still loading, opens its row by itself.
- Removed the second “Log a visit” button from the card. The check beside the bookmark does that job, and the visits row still lets you add an earlier day.
- The rating sits on one line with its label.
- Brought the browser checks back up to date with the three-stop drawer, the fold rows and the visit button. All 26 now pass against the sample or a local catalog. Checks that need a place that isn’t there, or a live address lookup that returns nothing, skip instead of failing.

## 2026-10-09 — Count every visit, and see where you go

- Add a **check button beside the bookmark** on a place card. Each tap logs a visit now, shows the running count on the button, and offers **Undo** for a few seconds. Two taps within 20 seconds count once. The bookmark keeps its meaning: **Save** (on my map, a place I want to know), so a place can be saved and not yet visited.
- Keep a private list of visits per place (`visitLog`: a time from a tap, a plain date for a past visit, or an undated entry). A place previously only marked visited counts as one visit with no date. Visited marks, pins, fog clearings, milestones, and Today work as before.
- In the expanded card, **Your visits** lists each visit, removes one, adds a visit on an earlier day (a future day is refused), or clears the place's visits. The card says how often and when you last went; list rows read Visited 3×. The old Mark visited toggle became Log a visit.
- In My Map, **Where you go** ranks places by visits over 14 days, 30 days, or all time (for example, 7 Brew, 3 visits in 2 weeks). **Show the heat map** draws the same counts on the map: warmer and wider where you go more, scaled against your busiest place (never less than four visits), under the street names and inside the fog's clearings.
- Marking a circuit stop Been here now logs a visit each outing.
- Visits are saved in map backups; imports drop invalid, future, and non-text entries and unknown places, and count an older backup's visited places once.
- Browser check seeds its own places and covers migration, tapping and the double-tap guard, undo, history, ranges and ranking, the heat toggle and weights (the layer itself when the basemap loads), older marks, clearing, saved versus visited, backup and import cleaning, and 320px. The earlier passing checks still pass.
- Limits: counts places, not paths or time spent; the heat map is places weighted by visits, not a track; the check is hidden in the compact strip (like the bookmark) and shows in the preview. Three older checks that still look for Mark visited were already failing.

## 2026-10-09 — Start a place from its website

- Add **Start from a website** to the top of the add-place dialog. Paste a website address (a bare domain works) and press **Read website**; nothing is read while typing.
- Fill the place name, address and category from what the page publishes, and offer its phone number, hours, published address and social links to keep. Details arrive ticked for review; only the ticked ones are saved, with their source and read date. Nothing is saved until Add to My Map.
- When the page publishes its own map location, offer **Use the map location this website publishes** as an alternative to an address lookup. The address is never looked up automatically: Find address still needs a button press and a chosen match.
- Keep the website address with the new place even when it was never read, or when reading was blocked. A website address that is not valid blocks saving with a plain message.
- Name choice: structured-data name first, then the site name, then a cleaned page title (filler such as Home and Welcome removed). A name that is only the site's domain ranks last. Suggest a category from the page's business type when the category is still Other.
- Reader fix: ask for robots.txt as plain text. Some servers (the Toledo Zoo's and Metroparks' among them) answered 406 to the page-oriented request, which was reported as being unable to check the site's rules. Page requests now also accept any content type as a fallback.
- Offline and browser checks cover page names and titles, the published location and its range checks, domain-like names, explicit reading, prefilled fields, kept and unticked details, a published pin, unread and blocked websites, invalid addresses, edit mode, and 320px layout. The earlier passing checks still pass.
- Read live against the Toledo Zoo, Metroparks Toledo and Kava Culture sites: names, phone, hours, address and social links were found where the sites publish them. The Toledo Museum of Art returned HTTP 403 and one local shop's domain did not resolve. Event import still happens from the place card after the place exists.
- Limits: only structured data and plain page metadata are read, so a site that publishes neither gives just a title; a page description is read but not yet kept. Restart the server to pick up the reader changes.

## 2026-10-08 — Personal circuits

- Build named, reusable outings from two to twelve saved, visited, or personally added places. Add an intention, choose walking/driving, and reorder or remove stops.
- Offer up to three known places within 1.5 km of the last stop as nearby additions; adding a suggestion also saves it to My Map. No new discovery request is made.
- Open circuits from the My Map route tool or list. Show numbered map pins and directions to the next unfinished stop, with flexible visit/skip/undo controls.
- Marking Been here records a place visit. Starting a fresh outing clears circuit progress while preserving place visits. Deleting a circuit preserves places.
- Keep circuits private in browser storage and version 1 backups. Validate imported place references, stop counts, progress, and text limits.
- Browser checks passed for creation, ordering, progress, map pins, travel modes, repeat outings, export/import, persistence, deletion, escaped text, and 320px layout; drawer and neighbor regressions passed.
- Map pins are an overview, not a calculated route. Opening hours, travel times, and automatic route optimization are not checked.

## 2026-10-08 — Three-stop mobile drawer

- Open place and neighbor cards as a compact icon/title strip, preserving map space.
- Drag the handle to the existing preview or fully expand to just below search. Tap the handle to cycle through the stops; keyboard arrows and Home/End also work.
- Keep content scrolling independent of handle dragging, respect reduced motion, and preserve desktop card behavior.
- Browser checks cover pointer dragging, tapping, keyboard controls, search clearance, 320px screens, desktop resizing, and neighbor editing and persistence.

## 2026-10-08 — Milestones and local lore

- Add private Milestones & local lore to My Map, accessible through its map tool and list summary.
- Award once-only points for adding/saving 1, 5, and 10 places; visiting 1, 5, and 10 places; and adding versus visiting five coffee shops. Existing places receive credit. Neighbors and personal details are excluded.
- Reveal five curated Toledo stories for two points each, retain them permanently, and show their approximate landmark pins on My Map. Include institutional source links on story cards. Revealing lore does not save a place or mark a visit.
- Store an earned/revealed ledger and derive the point balance; prevent repeat rewards from toggling visits and bound imported spending. Preserve progress in version 1 backups.
- Checks passed for earning, repeat prevention, spending, revealed pins, zero balance, neighbor exclusion, reload/export/import, and 320px layout. Ratings, Today, and neighbor regression checks passed.


## 2026-10-08 — Social connections

- Collect published social-profile links and structured sameAs connections during existing website reads, without visiting those destinations. Exclude common share widgets, platform home pages, and post links.
- Offer links for review before saving. Display accepted links in an Elsewhere row with platform labels/icons and links opening in a separate tab.
- Add Edit social links for manual additions, corrections, and removals. Keep source metadata for unchanged imported links and label manual entries as added by you.
- Preserve links in browser storage and map export/import. Neighbor entries remain separate. No feeds, embeds, platform searches, or tracking widgets.
- Checks cover extraction, normalization/deduplication, rejected links, review, correction, persistence/export/import, no social fetches, and 320px layout.


## 2026-10-08 — Private neighbor guide

- Add Neighbor guide to My Map and Remember a neighbor to the Add Place flow. Store a name/nickname, where you know them from, conversation notes, and an optional last-conversation date.
- Allow entries without any coordinates. Optional map-center pins appear only on My Map and create familiar clearings in the fog.
- Keep neighbor data separate from public place records, enrichment, website reading, Today suggestions, and calendar place choices. No ratings or business-profile actions on neighbor cards.
- Support editing, removal, search in My Map, browser persistence, and private map backup/restore.
- Browser checks passed for optional pins, safe note rendering, privacy/request boundaries, export/import/reload, deletion, and 320px layout. Today and category regression checks passed.


## 2026-10-08 — Today

- Replace the dormant Community navigation slot with Today, keeping four primary tabs.
- Build a local briefing from today’s nearby specials, today’s events at saved places, and up to three nearby saved/unvisited places.
- Use the existing calendar recurrence engine, including skipped dates. Show source links and read dates, ratings, distance references, and a full-calendar link.
- Start with four venues offering specials, with an option to show all. Suggestions and specials use a 10-mile radius from the current distance reference. Refresh the date after midnight or when returning to the page.
- Browser checks passed for schedules, exclusions, search/empty states, place/calendar navigation, and mobile/desktop layouts.


## 2026-10-08 — Living fog

- Thicken My Map’s fog and animate layered mist with a damped curl field around slowly moving eddies.
- Keep clearings anchored to saved/visited places with softer edges. Map gestures pass through the fog.
- Cap the mist canvas at 480px and painting at 20fps; stop animation in list/Explore, when disabled, or while the document is hidden. Reduced-motion users receive a still texture.
- Browser checks passed for animation, masking, motion preferences, toggles, and mobile/desktop canvas limits.


## 2026-10-08 — Personal categories

- Click a place card’s category to choose an existing category or create one by typing it. Add/edit place forms use the same searchable suggestions.
- Reuse personal categories in Explore filters, search, lists, and place cards; match existing labels without capitalization duplicates.
- Keep map category overrides in private details with an original-category reset. Preserve categories when editing hours/notes, reloading, and importing/exporting version 1 maps.
- Verify creation, reuse, custom-category import, overrides/reset, note preservation, filtering, and 320px layout; existing Explore filter checks pass.


## 2026-10-08 — Filters belong to the list

- Place category, relationship, distance, sorting, and schedule controls directly above Explore list results; keep the search filter panel synchronized.
- Refine the search bar and filter surfaces, with compact rounded selects and clear keyboard focus.
- Label unsaved listings accurately. Verify inline filtering, shared panel controls, and mobile/desktop views.


## 2026-10-08 — Explore filters

- Combine category, personal relationship, schedule, and distance filters in Explore, with removable active chips and a clear action.
- Show specials today or entries within the next seven Toledo calendar days, using personal, imported, and shared schedules.
- Sort by distance or name and show miles in list rows. Measure from downtown Toledo by default, or explicitly choose the current map center; no GPS request.
- Keep unknown/demo opening status out of Open now results. Filters remain in the current session and apply to Explore’s map and list.
- Browser checks passed for category, ratings, unvisited status, schedules, radius, nearest ordering, chips, empty results, and 320px layout; shared specials regression passed.


## 2026-10-08 — Shared specials appear in Calendar

- Convert the 20 loaded venues’ note-only specials into 35 recurring listings, preserving published descriptions and available weekday/time details.
- Display shared specials in agenda/month views and each venue’s upcoming entry, with source links and no changes to private saved events.
- Add a Specials map filter, offer-text search, and listing counts; remove placeholder text incorrectly used as opening hours.
- The current catalog contains 20 venues / 35 recurring listings; 44 separate listings were not present in the project.
- Browser checks cover shared recurrence, agenda/month, offer search, filtering, source links, reload, 320px layout, and existing personal calendar controls.


## 2026-10-08 — Personal place ratings

- Add a personal 1–5 star control below the place name, visible even when the card is collapsed. Change a rating or clear it.
- Show existing ratings in place-list rows for quick recognition.
- Keep ratings in browser storage and export/import. Rating saves the place but does not mark a visit. Invalid/out-of-range imported ratings are discarded.
- Browser checks passed for keyboard adjustment, persistence, list display, export/import, clearing, validation, and 320px layout.

## 2026-10-08 — Consolidated profiles and map-website reading

- Replaced the hidden map-facts panel with address, hours, phone, website, accessibility, and operator fields in the main place profile.
- Fold accepted website facts into their normal fields; keep only source links, methods, and dates in source disclosures. Remove the duplicate Visit published website button and duplicate private-note display.
- Expanding a place with a map-supplied website checks that URL once per browser session and offers findings for review. No automatic marks or bulk marker scans. Blocked reads preserve the profile link.
- Return to the top of the card after saving website information or place details.
- Controlled Kava Culture-shaped profile checks and website/discovery regression checks passed. Fixture values do not establish live venue details.

## 2026-10-08 — Hours and website at a glance

- Show hours and a direct website link below the place name, including the collapsed card.
- Prefer entered hours, then imported website hours, then the existing listing. Keep sourced facts available for reference.
- Keep hours out of the private People & notes section. Long schedules preview up to three lines when collapsed and show fully when expanded.
- Browser checks passed for collapsed-card visibility, website links, 320px layout, and existing place/calendar flows.

## 2026-10-08 — Keep website addresses independently

- Save the entered website before reading, including blocked and empty-result cases.
- Add Save website without any network request, plus Open website on the place card.
- Preserve the address across reload/export/import; calendar-feed previews do not overwrite it.
- Validate HTTP/HTTPS links and normalize bare domains. Browser checks passed for blocked/empty reads, independent saving, new-tab links, persistence, and existing import/calendar flows.

## 2026-10-08 — v0.5: Read websites for place details and calendars

- Added Read a website to expanded place cards, with an explicit review and selection step before saving.
- Read structured place name/address/phone/hours, published phone links, tentative hours excerpts, JSON-LD events, and iCalendar feeds. Inspect up to four public pages and preview linked feeds separately.
- Keep source links and retrieval dates. Imported profile facts stay separate from personal observations and do not move the pin.
- Import selected upcoming occurrences once, or follow a source and refresh it manually. Refresh replaces only source entries; failure keeps the last snapshot. Calendar/agenda and place next-occurrence views include imported entries.
- Preserve imports in reload/export/import. Provide removal controls on the place card.
- Use Lateral's ICS engine for recurrence, time zones, cancellations, and exceptions. Keep multi-day entries visible across their date range.
- Bound public requests, respect robots rules, block private/local destinations, pin DNS results, and validate redirects. Only the chosen URL is submitted; no map notes or history.
- Browser checks passed for review without saving, selected imports, following, refresh/failure retention, notes, reload/export/import, responsive widths, and URL-only requests. Pantry and personal-calendar checks passed. Parser tests cover structured data, feed links, recurrence, exceptions, robots, and network guards.
- Live Toledo library inspection found a phone number but no readable upcoming events/calendar links in inspected pages. Feed flows tested with controlled fixtures. Dynamic sites, arbitrary prose events, background refresh, and automatic event API discovery remain unsupported. Reads cached 15 minutes; calendar window 180 days.


## 2026-10-08 — v0.4: Place knowledge and private calendar

- Added editable private hours, people/roles, and notes to expanded place cards, separate from sourced map facts.
- Replaced Gatherings with Calendar: Agenda (next 90 days) and Month views, linked to places. Place cards show their next occurrence.
- Added place-linked events, specials, releases, and reminders with optional times and details. Entries support daily, weekly, monthly, and yearly repeats, intervals, optional end dates, series editing/deletion, and skipping one date.
- Added local phrase parsing into a reviewable draft: named weekdays, basic repeat phrases, today/tomorrow, ISO dates, and am/pm times. Other wording needs manual correction. No local model or external language service is connected.
- Adapted Lateral's wall-clock recurrence engine; Lateral was not modified. Unspecified times stay blank; all times use Toledo's America/New_York timezone. Monthly dates unavailable in a month are skipped. End times must follow start times on the same day.
- Details and calendar entries persist with existing version-1 maps and export/import. Adding knowledge or an entry saves the place; deleting a personal place removes its linked entries and details.
- Calendar browser checks passed for recurrence, skipped dates, series editing/deletion, persistence, export/import, and responsive widths. Map, personal-place, search, private-draft, and nearby-discovery regression checks passed; the live basemap loaded.
- No notification delivery, calendar subscriptions, public sharing, per-occurrence editing, or timezone selector yet. Opening hours remain details rather than recurring entries.

### Gidgit prompts and category choices
- Example prompts hide when typing or choosing an example, and remain hidden after a query.
- Explore filters include Coffee shop, Thrift store, and categories from place records and saved edits; category suggestions refresh with the map.

### Gidgit search corrections
- Removed persistent example pills. Recognize coffeeshop and thriftstore spellings; separate suggestions for multi-category requests. Ignore model-invented open-now/unvisited restrictions when the request does not ask for them. Future-visit requests clearly distinguish current hours from an unchecked future visit.

### Direct place-hours answers
- Questions about a named or selected place now answer from saved schedules before invoking AI, preserving open, closed, and unknown states. Match apostrophe variants, show saved hours and home time zone, and clarify ambiguous names. Broad open-place searches keep their filter behavior. Future-time questions remain outside this direct path.

### Hours format coverage
- Added Unicode and pasted-table normalization, missing day/time spacing, comma-separated day rules, dotted/spaced meridiems, day lists, closed-first wording and split shifts joined with “and.”
- Added 288 generated format-equivalence and normalization round-trip checks plus real-layout regressions and a read-only local hours audit. Saved raw text is preserved; supported layouts normalize for display and on explicit save. Ambiguous and holiday-specific rules remain reviewable rather than guessed.

### Monthly service schedules share the calendar engine
- Recognize ordinal weekdays, ordinal lists, last/fifth weekdays and mixed weekly/monthly opening windows; evaluate actual dates with the existing recurrence engine, including overnight spans and home time zones.
- Derive service occurrences for Calendar and nearby Today listings directly from place hours, with an Edit place hours action and no stored event duplication. Weekly shop hours remain outside Calendar.
- Natural-language calendar entry, monthly pattern editing, sanitization and persistence preserve ordinal weekday rules.
- Verified month/year/leap/DST boundaries, absent fifth weekdays, mixed schedules, open/closed Gidgit answers, derived listings, normalized editing and reload. Local audit recognizes 64 of 73 schedules; nine still require review for exceptions, annotations, appointments, or incomplete times.

### Live agenda eligibility
- Hide occurrences at their known end time from Agenda, Today, upcoming Explore filters and place next-event previews, using the home time zone and overnight end dates. Unknown-end entries remain labeled; Month retains history and no records are deleted.
- Refresh Calendar/Today every 30 seconds and on focus/visibility return; preserve list scroll and defer refresh while editing or using a dialog.

### Minimized daily briefing drawer
- Explore starts with a compact daily briefing strip over the map on mobile and desktop. Tap, drag or use keyboard arrows/Home/End to switch between compact and expanded positions below search.
- Returning to Explore, clearing search and reloading start minimized. Briefing content scrolls independently; live refresh preserves scroll and does not interrupt a drag.
- Verified mobile/desktop startup, both drag directions, keyboard control, search/place/Calendar navigation, narrow layout and reload.

### Area switching
- Tap the city in search to explore another city without changing home or saved places. Search, use device location, or return home.
- Three recent areas are available in the picker; long press or right-click opens it with recents focused. Each area remembers map position and zoom on this device.
- Today, nearby discovery, distance sorting, and opening-hour checks use the selected area and its configurable time zone.

### Place commons: reviewed contribution and import
- Share an explicitly selected place note through an editable public preview and approved JSON download. Neighbor entries and people fields never participate.
- Review JSON bundles from files or public GitHub snapshots, choose coordinate matches, and accept individual sourced claims separately from private notes.
- Preserve multiple independent source identities, detect duplicate/changed claims, review contested/retired updates, and export merged public bundles without private map bookkeeping.
- Add strict protocol validation, a fictional snapshot, contributor documentation, and firewall/browser regression checks.


### Civic context and gas observations — 2026-10-10

- Added Useful nearby with park-level Toledo amenities, preliminary AirNow readings and accurately labeled weekly EIA averages from official key-free feeds.
- Added gas station price reports with grade, cash/card/membership conditions and observation time; reports persist privately with export/sync and can be explicitly reviewed for commons sharing.
- Added a separate attributed civic-feed format, GitHub publisher workflow and source selection. AirNow publication requires guideline acknowledgment; unconfirmed Toledo republication is excluded. Civic data does not draw from private map or neighbor records.


### Wi-Fi place details and overlay

- Place cards can record Wi-Fi access, coverage, outlets, seating, availability hours, a published source and a personal confirmation date. Unknown details stay unknown.
- Civic now lists nearby recorded Wi-Fi places, five at a time, with a free-public filter and an optional map overlay.
- Details travel with private map exports and sync; they are not automatically published. No device scanning or neighbor records are used. This first version uses deliberately entered place details, not an automatic directory feed.


### Civic section navigation

- Sticky Overview, Conditions, Cameras and Amenities tabs replace the long Civic dashboard. Overview keeps weather, air quality and links into the detailed sections.
- Selection is remembered on this device. Keyboard navigation supports arrow keys, Home and End. Section changes preserve map position and overlay settings.
- Saved the preceding Civic UI in the sibling orient-checkpoints directory before this layout change.
