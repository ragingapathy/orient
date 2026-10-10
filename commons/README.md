# Orient place commons: first working loop

The private map remains private. A public bundle contains only selected observations, coordinate-anchored places, and source identities. The neighbor guide is never consulted by contribution code.

## In Orient

1. Open a place, expand People & notes, and choose **Share this note**. Review/edit the excerpt, place name and longitude/latitude, choose a kind and observation date, and confirm permission to share under CC BY 4.0. This does not change your private note.
2. Preview the entire public JSON file and approve its download. There is no upload. Sharing a personal-observation claim means you affirm that you observed it yourself.
3. Open **Field kit → Place commons** to review a JSON file or load a public GitHub JSON snapshot. Select individual observations and explicitly choose nearby matches or create coordinate-anchored places. Accepted claims stay separate from private notes.
4. **Review export of accepted observations** produces a portable merged bundle, preserving originating source IDs. It can include multiple independent Toledo sources. Review it before downloading and publishing.

## GitHub workflow

Commit reviewed bundles to a repository of your choice, for example `cities/toledo/snapshot.json`. Contributions can arrive as separate bundle files through pull requests. A maintainer can import them into Orient, review and accept them, and export a combined snapshot. Preserve claim and source IDs when moving between repositories: the mirror's repository URL is not a new author identity. GitHub commit history retains earlier snapshots.

Orient accepts public `raw.githubusercontent.com` JSON URLs and ordinary GitHub `/blob/` file links. These load in your browser with no credentials, only when requested. File import works offline. No GitHub account, authentication integration, automatic background pulls, or automatic submissions are included in this first version.

## Bundle v1

- `format`: `orient-commons`; `schema_version`: 1.
- `sources`: `{id, name, license: "CC-BY-4.0", url?}`. Stable ID, human label, optional HTTPS repository/source URL. Identity is attribution, not verified authorship.
- `places`: `{source_id, id, name, coordinates: [longitude, latitude]}`. No OSM identity or lookup. Coordinates are contributors' placement, not a verified entrance.
- `claims`: `{source_id, claim}`. `claim` follows `schema/claim.schema.json`.
- Source ID plus claim ID identifies an observation; source ID plus place ID identifies a source's place. Distinct sources never silently overwrite each other. Nearby coordinates only suggest local matches.
- Unknown fields, malformed dates/coordinates, dangling references, duplicate identities, oversized bundles and private-map exports are rejected. Limits: 1 MB per file/fetch, 50 sources, 200 places, 500 claims. Imported changes require review. Missing claims are not interpreted as deletion; use `retired` explicitly.
- Your local links to place IDs are private bookkeeping and are never included in a public bundle. Coordinates and place names selected for contribution are explicitly visible in its preview.

## Boundaries

There is no automatic extraction from notes and no neighbor scanning. Only the place note you explicitly choose is offered in the contribution dialog. A schema can exclude private fields; it cannot determine whether an otherwise valid sentence identifies a person. The contributor must remove personal information and have permission to share. The people field is never copied.

The first UI creates personal-observation claims. The protocol also accepts published-source claims with an HTTPS URL and retrieval date, affirmations, contested/retired status, and supersession references. Dedicated editing/affirmation controls and directory-based snapshot tooling are future work. Runtime validation is in `public/commons-data.js`; it also validates restored local records. Local map backup/sync retains accepted observations without turning private backup into a public bundle.

The public bundle format uses CC BY 4.0 for contributed observations. This does not relicense the Orient application or make third-party content yours to contribute. The example is fictional.
