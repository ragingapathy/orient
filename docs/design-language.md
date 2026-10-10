# Orient's design language

This is the visual and verbal language the whole app follows. It comes from **Your map so far** (the stats drawer on My Map) and is carried by `public/ui.css`, `public/ui.js` and `public/mascot.js`. When you add or change a screen, start here.

## The feeling

Warm, calm, and a little playful. Orient describes what you did and what you could do next; it never scolds. No streaks, no targets, no "you missed". Empty states invite ("Ready when you are") instead of reporting zero. Words are plain and short.

## The pieces

| Piece | Use it for | How |
|---|---|---|
| **Card** | any grouped content | `.set-card`, `.ui-card`: soft white, 1px `--line` border, 16px radius |
| **Kicker** | the small label above a title | `.ui-kicker`, `.set-kicker`, `.kicker`: 10px, uppercase, accent colour |
| **Icon tile** | the badge beside a heading | `.set-ico`, `.dlg-ico`: 36–40px rounded square on `--land`, green glyph |
| **Hero tiles** | the few numbers that matter | `.ui-tile` (also `.teal`, `.orange`, `.gold`): gradient, bold Inter numerals |
| **Row** | a setting or an action in a card | `.set-row`: label and one line of help on the left, one control on the right |
| **Switch** | on/off | a checkbox inside `.toggle-row` (drawn as a switch; never a tick box) |
| **Chip** | short suggestions and filters | `.ui-chip` inside `.ui-chips` |
| **Status dot** | state at a glance | `.ui-status` inside an element with `data-state="ok|syncing|offline|unpaired"` |
| **Disclosure** | the long fine print | `details.ui-more` |
| **Mascot** | Gidgit, and only Gidgit | `OrientMascot.html(mood)`; moods: idle, thinking, happy, confused |

Colour: `--green` for primary, `--accent` (orange) for emphasis and kickers, `--land` for quiet fills, gradients only on hero tiles and the year card. Numerals use Inter bold (Isometra's slashed zero reads as a letter). Radii: 12 / 16 / 22.

## Dialogs

Every `<dialog>` is styled by `ui.css`, including ones made in JavaScript. To get the standard look, give the dialog a `.panel-heading` containing an `<h2>` and a close button, and add its id to the `ICONS` map in `ui.js` for its header icon. Inside, use cards, rows and `.button` (add `.primary` for the one main action, `.danger` for destructive ones). Keep ids, `data-` attributes and visible button names: tests and code depend on them.

## Motion

Things rise in (about 0.3s). The mascot bobs, blinks, wiggles when thinking, hops when it has an answer. All of it stops under `prefers-reduced-motion`; use `@media(prefers-reduced-motion:reduce)` for anything new.

## Accessibility

- Decorative text drawn with CSS goes in `content:"+" / ""` so it is not read as part of a name.
- Controls keep their accessible names (use `aria-label` when the visible text is shorter).
- Focus rings are visible (3px accent). Targets are at least 36px, usually 42–48px.
- Nothing is conveyed by colour alone: status dots sit beside words.

## Privacy

Anything computed about the person (counts, patterns, summaries) is computed on their device from their own map. Do not add network calls to build a screen.

## Checking your work

Run `node ui-check.cjs` (this system), `node insights-check.cjs` (the stats drawer) and `node map-labels-check.cjs`. Look at a real screenshot on a computer and on a 390px phone before calling a screen done.
