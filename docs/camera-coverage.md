# Civic camera coverage

Updated October 11, 2026.

## Automatic public feeds

- Michigan: MDOT Mi Drive locations statewide; snapshots resolved when a camera is opened. No account or API key. Official map endpoints: `/MiDrive/camera/AllForMap` and `/MiDrive/camera/getCameraInformation/{id}` on mdotjboss.state.mi.us.
- California: Caltrans CWWP2 CCTV JSON feeds for all 12 districts. No key. Disabled cameras are excluded; individual district failures preserve successful districts.
- Plate readers: national OpenStreetMap ALPR locations, the same underlying data used by DeFlock. Includes Flock and other makes. These are mapped installations, not access to surveillance video or plate records. Volunteer coverage is incomplete. OSM attribution and ODbL license are displayed. Approximate selected-area coordinates are sent in public Overpass GET queries with a bounded fallback.

## Guided key-based camera connectors

Ohio (existing OHGO), Wisconsin, Idaho, Alaska, Nevada, Louisiana, Arizona, and Utah. Settings → Civic sources offers official signup links and encrypted key storage. The seven new 511 adapters use the documented `/api/v2/get/cameras` schema. These adapters passed representative response/key-failure tests; real authenticated access requires a user's provider key and has not been independently verified for every agency.

Camera-only connections are stored separately from a roadwork connection, so adding a camera key does not replace roads. Tokens remain outside map exports and sync. A hosted installation must keep its data volume (the encryption master key) persistent.

## Behavior and limitations

Public camera metadata is cached for ten minutes and shared across requests. Images load directly from agencies and are not archived. Michigan image metadata loads only for the opened camera. Results are geographically filtered around the selected city; up to 800 nearest cameras are retained. This is not blanket coverage of every US state. An unsupported area is distinguished from an unavailable source or a supported area with no nearby cameras.

Live checks on the installed Docker service: Detroit-area query returned 439 traffic cameras; Michigan image lookup returned a working JPEG; another Detroit-area ALPR query returned 1,567 mapped readers, of which 1,233 were tagged Flock. Sacramento-area query returned 367 cameras with all district requests successful. Counts are observations, not promises of current statewide totals.

## Official references

- https://www.michigan.gov/mdot/about/mi-drive-disclaimer
- https://cwwp2.dot.ca.gov/documentation/cctv/cctv.htm
- https://511wi.gov/help/endpoint/cameras
- https://511.idaho.gov/help/endpoint/cameras
- https://511.alaska.gov/help/endpoint/cameras
- https://www.nvroads.com/help/endpoint/cameras
- https://511la.org/help/endpoint/cameras
- https://az511.com/help/endpoint/cameras
- https://www.udottraffic.utah.gov/help/endpoint/cameras
- https://deflock.org/app
