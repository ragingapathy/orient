# Orient Changelog

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
