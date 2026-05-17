# Emotional Noise Lab

Real-time browser prototype for exploring procedural noise systems, animated gradients, and saved emotional presets.

## Stack

- React
- TypeScript
- Vite
- Raw WebGL + GLSL fragment shader

## Run locally

1. Open a terminal in `web/`
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

The built files are written to `web/dist/`.

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

- Presets are automatically loaded from and written back to `web/data/presets.json` while the Vite dev or preview server is running.
- A browser cache copy is also kept as a fallback for offline recovery and thumbnail backfill.
- Saved thumbnails are captured from the live WebGL canvas, written into preset JSON, and older presets without thumbnails are refreshed automatically on load.
- The shader architecture is set up so each noise type produces a distinct modulation field rather than a flat texture swap.
