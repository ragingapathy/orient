# Orient place commons: first working loop

The private map remains private. A public bundle contains only selected observations, coordinate-anchored places, and source identities. The neighbor guide is never consulted by contribution code.

## In Orient

1. Open a place, expand People & notes, and choose **Share this note**. Edit the observation and confirm permission to share under CC BY 4.0. The place name, map pin, type, date and commons identity are filled in for you under **Details**, and can be changed there. This does not change your private note.
2. Review the contribution in plain words (the exact JSON is under **Show the file that will be shared**), enter the commons repository, and press **Open on GitHub to finish**. Orient opens GitHub’s new-file page with the file filled in. You sign in as yourself, press **Propose new file**, then **Create pull request**; GitHub makes the fork for you when you cannot write to the repository. **Copy the file**, **Download the file**, or publishing with a token are under the preview. Sharing a personal-observation claim means you affirm that you observed it yourself.
3. Open **Field kit → Place commons** to review a JSON file or load a public GitHub JSON snapshot. Select individual observations and explicitly choose nearby matches or create coordinate-anchored places. Accepted claims stay separate from private notes.
4. **Review export of accepted observations** produces a portable merged bundle, preserving originating source IDs. It can include multiple independent Toledo sources. Review it before downloading and publishing.

## Hosting a commons

[`commons-template/`](../commons-template/README.md) is a ready-made repository for the maintainer side. Copy it into a new public GitHub repository and you get a check on every contribution pull request (valid public bundle, append-only, a table of what is proposed, warnings for anything that looks personal or replaces published work) and a `snapshot.json` rebuilt automatically when you merge. The checking code runs from your main branch, so a contribution cannot loosen its own rules. When a commons grows past Orient’s limits it is split into `snapshot.json`, `snapshot-2.json` and so on. `node commons-template-check.cjs` tests all of it offline.

## GitHub workflow

Commit reviewed bundles to a repository of your choice, for example `cities/toledo/snapshot.json`. Contributions can arrive as separate bundle files through pull requests. A maintainer can import them into Orient, review and accept them, and publish or export a combined snapshot. Preserve claim and source IDs when moving between repositories: the mirror's repository URL is not a new author identity. GitHub commit history retains earlier snapshots.

Orient accepts public `raw.githubusercontent.com` JSON URLs and ordinary GitHub `/blob/` file links. These load in your browser with no credentials, only when requested. File import works offline. Loading and file import need no GitHub account. Publishing requires a one-time GitHub connection and an explicit Publish action; Orient creates a contribution branch/file and pull request, using a fork when you lack write access. There are no background pulls or submissions.

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

## Sharing without a token

The default route needs no secret. Orient builds `contributions/<bundle-hash>.json` (the same name and content the token route would create) and opens `https://github.com/<owner>/<repo>/new/<default-branch>?filename=…&value=…`. When you press the button, the browser asks GitHub’s public API for the repository’s default branch (the repository name is the only thing sent; no credentials), then GitHub’s editor shows the file for you to review. Orient never sees your GitHub login, and nothing is merged until a maintainer accepts it. A very long contribution cannot fit in a link; Orient then says so and offers **Copy the file** (paste it into GitHub’s **Add file → Create new file**) or the token route. Pressing the button also records the contribution locally, the way Download does.

## Other route: publish from Orient with a token

Under **Other ways to share** on the contribution preview, expand **Connect GitHub once**. This self-hosted version accepts a GitHub access token. For a repository you can write to, a fine-grained token needs Contents and Pull requests read/write on that repository. Fork contributions currently require a classic token with `public_repo` scope. The repository must be public and initialized with a commit. The app does not borrow the server owner's CLI credentials.

The server validates the token with GitHub, stores it encrypted in ignored `data/github-connections.json` using `data/github-connections.key`, and gives that browser a separate HttpOnly, SameSite session cookie. Tokens are never written into the map, localStorage, public bundles, or API responses. Local/paired-browser access is required. Connections last up to 90 days, subject to the token's own expiry; Disconnect removes the stored connection. A deployment-wide OAuth sign-in setup is not included yet.

Connecting does not publish. After reviewing the contribution and destination, press **Publish from Orient with a token**. Orient submits `contributions/<bundle-hash>.json` on a dedicated branch, opens a pull request, and displays its link and status. Identical retries reuse the request, including a closed/merged request, rather than silently reopening it. A newly created GitHub fork can take a moment to be ready; an error leaves the preview available for retry. No maintainer branch is directly modified and no pull request is automatically merged.

Run `node commons-publish-check.cjs` and `node commons-publish-api-check.cjs` for mocked GitHub and local endpoint checks. `commons-open-check.cjs` covers the no-token route (form, plain preview, repository checks, link contents, copy, and that no token endpoint is called). `commons-publish-ui-check.cjs` exercises connection, explicit submission, failure/retry, and the resulting PR link with fictional data and mocked requests; it never publishes a real contribution.
