# Civic feeds

This is separate from the CC BY personal-observation snapshot. Source-specific rights and attribution remain attached. No private Orient map, neighbor records or browser data enters this workflow.

1. Set a stable `sourceId` and regional center in `civic.config.json`.
2. Read [AirNow Data Exchange Guidelines](https://docs.airnowapi.org/docs/DataUseGuidelines.pdf), complete their notification/contact/agreement requirements with AirNow and the relevant agencies, then set `airnowGuidelinesAcknowledged` to true. No email is sent automatically. Do not acknowledge this until it is actually done. The workflow refuses public AirNow publication otherwise. Alternatively set `airnow` false to publish EIA only.
3. EIA averages use its official public RSS feed without a key. Optionally configure `EIA_API_KEY` as a repository secret to use its JSON API instead. `eiaAreas` must use EIA area IDs and accurate names (SOH = Ohio, R20 = Midwest). These are weekly averages, never individual pump prices or a substitute city average.
4. Enable/run the Civic data workflow. It updates `civic-data/civic.json` twice hourly, replacing the branch commit instead of accumulating readings forever.
5. In Orient → Useful nearby, paste `https://raw.githubusercontent.com/OWNER/REPO/civic-data/civic.json` into Civic feed URL. Each browser keeps this source preference; no key is embedded.

The published snapshot carries its publisher identity and original AirNow agency, pollutant, AQI, category and timestamp. Observations remain preliminary; the app stops displaying old readings. EIA values retain their reporting period and attribution. Old feed snapshots are rejected. Partial source failure is represented explicitly; an all-source failure does not publish.

Toledo park amenities currently appear only through the local source adapter. Their republication terms have not been confirmed, so the workflow excludes them. Park-level coordinates identify the park, not the precise fixture. No OSM-derived data is republished by this feature.

Gas station observations are private until their author chooses Share and reviews the existing commons contribution. They are shared as dated price observations, not merged into an invented city average.
