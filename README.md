# Geophonia
NASA Space Apps Challenge -  Earth Juke Box

# Earth Information Jukebox application

Independent NASA Space Apps Challenge 2026 submission prototype. No NASA endorsement.

Requires Node.js 22.12+ (verified with 24.22.1) and npm.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

Vite is the only direct development dependency. Source is browser JavaScript ES modules. Assets and sampling run locally; no backend or app credentials. `npm run dev` prints the local URL. Managed Sites preview uses the platform's preview CLI instead.

Source: NASA SVS 3912, ECCO2 ocean visualization; frame 23000 at 2007-03-25 12:00 UTC. This version deliberately has one frame. See `public/data/source-manifest.json`, `docs/alignment.json`, `docs/milestones.md`, and `docs/mappings.md`.

Focus map with Tab; arrows move by selected degree step, Home resets. Pointer and coordinate form share the same location. The map is a localized ARIA application region; Tab leaves normally. Directional buttons offer an alternative. Web Mercator latitude range is ±85.0511°. East/west navigation wraps across the antimeridian.
