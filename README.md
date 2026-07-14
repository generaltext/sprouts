# Sprouts

A calm, private baby log — a General Text app. Feeds, sleep, diapers, growth,
milestones, logged in a tap from either parent's phone and kept as plain files you
own. Plus a print-ready poster of the whole first years. No predictions, no ads, no
account.

- Product: https://www.generaltext.org
- App guide: https://www.generaltext.org/llms.txt (local: `projects/generaltext/content/docs/building-apps.md`)
- Plan: `planning/apps/sprouts/init.md` in the meta repo.

## How it works

**Storage — append-only event logs, one per child.** Multi-child is first-class:
`v0/children.jsonl` holds child profiles (`child.create/update/archive`), and each
child's activities live in their own sharded log — `v0/logs/<childId>.0.jsonl`,
`.1.jsonl`, … numbered files that grow forward in time (shard 0 oldest; a new file
is only added, never renamed), each kept under the platform's ~900 KiB single-frame
sync cap — one immutable JSON event per line (`entry.log` / `entry.remove`). The UI is a projection folded from the
log (`src/lib/reducer.ts`). Appends read the freshest file content and add to the end,
so the runtime diffs each write to a pure end-insertion and concurrent appends from
two phones both survive. Nothing is rewritten in place; editing an entry is a
re-appended `entry.log` (last-writer-wins in the fold, keyed by entry id).

**Caregivers are derived, not stored.** Every entry carries the `actor` who logged it
(from `gt.user()`, or a local fallback). The caregiver list is just the distinct
actors across the log, each given a stable colour hashed from its id
(`src/lib/caregivers.ts`) — so a nanny or grandparent "joins" simply by opening the
workspace and logging, with no setup and no extra file.

**Activity kinds** (`src/lib/types.ts`): `sleep`, `feed.bottle` / `feed.breast` /
`feed.pump` / `feed.solid`, `diaper`, `growth`, `tummy`, `medicine`, `milestone`,
`note`. Values are stored canonically (millilitres, grams, centimetres, seconds) and
rendered through a per-user imperial/metric preference (`src/lib/units.ts`, UI-local,
not synced).

**Growth uses the WHO Child Growth Standards.** `src/data/who.json` bundles the LMS
parameters (0–60 months, per sex, for weight / length-height / head circumference);
`src/lib/who.ts` computes percentiles and z-scores client-side so the chart shows
faint P3–P97 bands behind the child's own line. Descriptive context, never a target.
Regenerate with `pnpm who` (`scripts/build-who.mjs`).

**Poster mode** (`src/lib/poster.ts` + `poster-data.ts`) turns the whole log into
print-ready wall art: a stacked day-by-day sleep chart, or a radial spiral of the
first years. One canvas renderer drives both the live preview and the high-res PNG
export, so what you see is what downloads. Sleep is split across midnight into
per-day fractional segments so the day/night rhythm reads correctly.

**Rendering** is plain React + Tailwind; charts are hand-rolled SVG/CSS and the poster
is `<canvas>` — no chart deps, nothing to load from a CDN (the app runs under a
no-egress CSP). The timeline renders days incrementally (more as you scroll) so a
multi-year log stays snappy.

## The runtime

No sync client is bundled: the platform injects `window.gt` (see `src/gt.d.ts` for the
subset used). Files are read/written through it; light/dark follows the shell's theme.
Opened outside General Text, the app shows an install splash with a "Try the demo"
button that boots a local in-browser workspace seeded with a synthetic sample baby
(`src/components/MissingRuntime.tsx`, `src/lib/demo.ts`).

## Local development with real data

`pnpm dev` runs the app standalone against a local in-browser workspace (a dev-only
Vite plugin injects the runtime). On first run it seeds from a converted export:

```
pnpm nara [path/to/export.csv]   # → src/data/seed.dev.json (gitignored, DEV-only)
pnpm dev                         # standalone, seeds that data on an empty workspace
```

`src/data/seed.dev.json` is **gitignored and dev-only**: it's imported behind
`import.meta.env.DEV` via `import.meta.glob`, so a missing file is simply "no seed"
and the real data is tree-shaken out of the production bundle entirely — it can never
reach the public origin or the gallery demo. The public "Try it live" demo always uses
the synthetic child in `src/lib/demo.ts`.

## Scripts

```
pnpm dev         # standalone dev server (runtime injected)
pnpm build       # tsc --noEmit && vite build
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest (reducer/fold)
pnpm nara [csv]  # convert a Nara Baby export → dev seed (gitignored)
pnpm who         # regenerate the bundled WHO growth tables
```

## Files it writes

- `v0/children.jsonl` — child profiles (name, birth date, sex).
- `v0/logs/<childId>.0.jsonl`, `.1.jsonl`, … — each child's append-only activity
  log, sharded into numbered files (shard 0 oldest, growing forward) so no file
  exceeds the sync size cap. Bulk/historical data is best brought in via the app's
  **Import log** action (Settings), which writes through the FileAPI — dragging a
  file into the workspace folder on desktop ingests content but doesn't register or
  sync it.
