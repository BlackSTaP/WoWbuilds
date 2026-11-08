# Forever Atlas

Static WoW Forever build library with a bilingual, interactive talent calculator. Open `index.html` directly or serve this directory with any static HTTP server. No build step, framework or production dependencies are required.

## Calculator

- All three complete trees open from each of the 46 presets: 467 talents in the pinned source export, across 9 classes.
- Desktop: hover/focus for bilingual tooltips, left-click/Enter to add, right-click/Shift-click or minus/Delete to refund. On touch screens and narrow viewports, tap to inspect and use the tooltip's + / − buttons.
- Enforces 51 points, rank caps, five points per earlier row and fully ranked prerequisites. Refuses refunds that would break dependencies or tier gates.
- Reset one tree, clear all points, or restore the preset. An edit keeps a legal leveling order; the progression tab updates with it.
- The share link includes both talents and their point order. Old `#build=…` links remain supported. Custom links use `v=1&o=…`; node ordering must remain stable unless that version is migrated.
- RU/EN controls in the page header and build dialog switch the full UI and primary tooltip language. Both English and Russian remain visible in every tooltip. The language and favorite presets persist locally. Unshared custom edits last for the current page session.
- The calculator uses the standard level-10 first point. It does not track player levels or apply early-point Legacy perks.

## Personal builds, links and guides

- Save opens a portable link editor. The URL fragment contains the preset/class reference, version, full talent order and optional name (`n`). Copying or bookmarking this link is sufficient to open the same build on another device, without an account, local storage or an imported file. Older unnamed links still work.
- My builds is an optional local list of these build links. Name, update, duplicate and delete entries; export/import a versioned JSON backup. Normal clicks reopen an entry; its actual hyperlink also supports opening in another tab. Up to 100 records and 1 MB per import. Import validates the entire file before writing, preserves existing builds, skips identical entries and assigns fresh IDs. Storage failures are reported; sharing a link remains available.
- Hover/focus/tap highlights a talent's prerequisite chain and dependent talents. Missing ranks are dashed pink, prerequisites gold, dependents purple. Tooltips show the exact points missing from earlier rows and prerequisite ranks. Unlearned icons stay dark.
- Guide is a separate tab for all 46 presets, in RU/EN. The short tactical text paraphrases each preset's linked WoW Forever Builder page, reviewed November 8, 2026. Equipment notes are general role heuristics, not calculated stat weights or verified caps. Key talents are derived from the current allocation. Edited builds show that the tactics describe the source preset.

## Data and attribution

`talents.json` is the editable calculator dataset; `talents.js` is its generated, offline-compatible browser version. `talent-name-overrides.json` records terminology corrections. After changing data or names:

```sh
node scripts/sync-talents.cjs
```

Trees, prerequisites, per-rank English descriptions and confirmed-rank flags are adapted from [Talents Forever's export](https://talentsforever.com/data.json), generated **4 November 2026**, client **1.60.1.70755**, with that export's per-class hotfix annotations. Credit: [talentsforever.com](https://talentsforever.com/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Game names, icons and tooltip text belong to Blizzard Entertainment. This is a dated community snapshot, not automatic live-client synchronization. It has 467 nodes; do not silently combine it with other sites' differently versioned trees.

Russian descriptions are a **machine-assisted, unofficial translation**, with terminology and selected wording corrections. The original English is always included for comparison; this is not an official Blizzard localization. Numerical values in all translated ranks are checked against the English source. A rank not marked confirmed by the export is labeled in the tooltip.

The 46 presets and original routes come from [WoW Forever Builder](https://wowforeverbuilder.com/builds/), with a direct source link per build in `data.json`. The existing `validation.json` describes the earlier preset-only comparison against community build 70862; it is not the version of the new calculator dataset. The automated tests now validate every original route, including prerequisites, against the pinned calculator source.

Images: Blizzard Entertainment, sourced from WoW Forever Builder and the Wowhead icon CDN. The hero is [Ley line in the night forest](https://wowforeverbuilder.com/wallpapers/cinematic/ley-line-night-cinematic/). Fonts use Google Fonts with local fallbacks. No other runtime network request is needed for talents or translations.

## Validation

Node 20 or newer:

```sh
node --test tests/*.test.cjs
node --check app.js
```

Tests cover every preset/prefix, link round trips and invalid input, rank/tier/prerequisite/budget rules, dependency-safe refunds, tree resets, bilingual coverage, numeric fidelity, icon existence and generated-data consistency. Browser checks cover desktop editing, locale switching/persistence, shared links, keyboard tooltips and mobile layout.

This is an independent fan project, not affiliated with Blizzard Entertainment.
