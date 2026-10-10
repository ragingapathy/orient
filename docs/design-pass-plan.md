# Design pass: what's left

Working branch: `design-pass` (worktree `C:\Users\atomj\orient-design`). Gidgit's own rework happens in the main folder; this plan stays out of `gidgit*.js`, `gidgit*.css`, `mascot.js` and the mood code in `ui.js`.

Rules for every step: follow `docs/design-language.md`; look at a desktop (1000px) and a phone (390px) screenshot before calling it done; keep ids, `data-` attributes and visible button names; run `node ui-check.cjs` and the full suite (only the 18 known-stale checks may fail); commit one step at a time to the branch and push the branch (not `main`, while the main folder has someone else's uncommitted work).

1. **Audit every dialog and panel.** One script opens each (Add, Category, Outing, Photo, Website, Social, Circuit editor and viewer, Commons hub, Takeout, Directions, Neighbor, Knowledge, Calendar details, Home, first-run welcome) at both sizes and saves screenshots. Write down what looks off.
2. **Fix what the audit finds**, mostly in `ui.css`, so nothing fights `style.css`. One commit per area.
3. **Neighbor card and Explore list filters.** The two panels that only inherit the new type so far.
4. **The floating pieces:** top bar, search bar, filter panel, map tool buttons, bottom navigation, the map's own pins and legend. Same radii, tints and focus rings.
5. **Empty and first-run states.** Welcome screen, empty My Map, empty collections, empty calendar. Invite, never report zero.
6. **Add checks** to `ui-check.cjs` for anything that regressed in practice (contrast, overflow at 390px, reduced motion).
7. **Stretch, separate commit:** open-format export (GeoJSON and CSV) as a tile in "Your data", from the Craft ideas list.
8. **Landing:** once the Gidgit session has committed in the main folder, merge `design-pass` there (expect a small `CHANGELOG.md` conflict), run the suite, push `main`.

Not in scope: Gidgit's look and motion (separate session), `style.css` layout, the data model, the sync and commons code.
