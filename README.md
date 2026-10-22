# Emotional Noise Lab

Real-time browser prototype for exploring procedural noise systems, animated gradients, and saved emotional presets.

## Stack

- React
- TypeScript
- Vite
- Raw WebGL + GLSL fragment shader

## Run locally

1. Open a terminal in the repository root.
2. Install dependencies:

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev
```

4. Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`

## Production build

```bash
npm run build
```

The built files are written to `dist/`. On Vercel, use `npm run build` as the build command and `dist` as the output directory.

Preset loading and browser persistence regression checks can be run with:

```bash
node --test tests/presets.test.mjs
```

## What is included

- Left sidebar with selectable procedural noise systems and per-noise parameter controls
- Center WebGL preview canvas with animated gradient/noise interaction
- Right sidebar with gradient type, colorway, movement, blend, and tuning controls
- Repo JSON-synced favourites panel with:
  - save current combination
  - instant restore
  - rename
  - delete
  - export presets as JSON
  - import presets from JSON
- Randomize, reset, and pause animation controls

## Notes

- During `npm run dev`, presets are automatically loaded from and written back to `data/presets.json`.
- Production builds, including Vercel and `npm run preview`, include that JSON as a separate static asset. Deploying a new build publishes the committed recipes and their thumbnails.
- On the deployed site, new presets, renames, tab assignments, and deletions are saved in the current browser. Existing browser changes survive reloads; later deployments add newly published preset and tab IDs. To share new recipes with everyone, export them, update `data/presets.json`, and deploy again.
- A browser cache is kept for offline recovery and thumbnail backfill. If storage is tight, cached thumbnails are omitted and restored from the published library when available.
- Saved thumbnails are captured from the live WebGL canvas; older presets without thumbnails are refreshed automatically on load.
- The shader architecture is set up so each noise type produces a distinct modulation field rather than a flat texture swap.
