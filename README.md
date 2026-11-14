# Geophonia
NASA Space Apps Challenge -  Earth Juke Box

# Earth Information Jukebox application

Independent NASA Space Apps Challenge 2026 submission prototype. No NASA endorsement.

Requires Node.js 22.12+ (verified with 24.22.1) and npm.

```sh
npm install
npm run dev
npm test
npm run check
npm run build
npm run preview
```

Vite is the only direct development dependency. Source is browser JavaScript ES modules. Assets and sampling run locally; no backend or app credentials. `npm run dev` prints the local URL. Managed Sites preview uses the platform's preview CLI instead.

Source: NASA SVS 3912, ECCO2 ocean visualization; frame 23000 at 2007-03-25 12:00 UTC. This version deliberately has one frame. See `public/data/source-manifest.json`, `docs/alignment.json`, `docs/milestones.md`, and `docs/mappings.md`.

Focus map with Tab; arrows move by selected degree step, Home resets. Pointer and coordinate form share the same location. The map is a localized ARIA application region; Tab leaves normally. Directional buttons offer an alternative. Web Mercator latitude range is ±85.0511°. East/west navigation wraps across the antimeridian.

Start Audio begins sonification; Pause or Silence all audio stops it. Escape silences immediately. Volume defaults to 25%, pitch 160–800 Hz. Missing visual samples have a two-note cue, never a fabricated measurement. The audio legend demonstrates pitch, trace coverage and no-sample cues. Background tabs require explicit audio restart.

Feature definitions, thresholds, projection and lifecycle: `docs/mappings.md`. Verification limits and demo: `docs/accessibility-checks.md`. Milestones 4–8 are not implemented.

Assets are committed so ordinary setup needs no Python. To reproduce their derivation, use Python 3 with Pillow/NumPy and run `python scripts/prepare-assets.py --cache /absolute/cache`. Source hashes are checked before transformation. Derived colors use nearest-neighbor resampling and source sampling uses the original-resolution PNG.

In the managed environment, Sites helper scripts and the browser-control tool were unavailable. npm was run directly with a workspace-local cache; source synchronization and deployment packaging use ordinary Git and a tar archive containing the exact built output and hosting manifest. No credentials are stored in source.
