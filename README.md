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

Source: NASA SVS 3912, ECCO2 ocean visualization; frame 23000 at 2007-03-25 12:00 UTC. Each dataset has three frozen dated frames. Focus the timeline for Left/Right and Home/End, or use Previous/Next; geographic selection stays fixed. See `public/data/source-manifest.json`, `docs/alignment.json`, `docs/milestones.md`, and `docs/mappings.md`.

Focus map with Tab; arrows move by selected degree step, Home resets. Pointer and coordinate form share the same location. The map is a localized ARIA application region; Tab leaves normally. Directional buttons offer an alternative. Web Mercator latitude range is ±85.0511°. East/west navigation wraps across the antimeridian.

Start Audio begins sonification; Pause or Silence all audio stops it. Escape silences immediately. Volume defaults to 25%. The continuous data voice is a low 110 Hz ambient root whose filter cutoff and resonance follow the image-derived palette position; density controls its gain. The 160–800 Hz range remains available for legends and navigation cues. Missing visual samples have zero data tone and no background guide. Shoreline crossings have short knock/droplet notifications. Background tabs require explicit audio restart.

Feature definitions, thresholds, projection and lifecycle: `docs/mappings.md`. Verification limits and demo: `docs/accessibility-checks.md`. Milestones 2–4 are implemented; milestones 5 and 6 are implemented; manual accessibility/listening review remains pending.

Assets are committed so ordinary setup needs no Python. To reproduce their derivation, use Python 3 with Pillow/NumPy and run `python scripts/prepare-assets.py --cache /absolute/cache`. Source hashes are checked before transformation. Derived colors use nearest-neighbor resampling and source sampling uses the original-resolution PNG.

In the managed environment, Sites helper scripts and the browser-control tool were unavailable. npm was run directly with a workspace-local cache; source synchronization and deployment packaging use ordinary Git and a tar archive containing the exact built output and hosting manifest. No credentials are stored in source.

Milestone 4 uses approximate Natural Earth land/lake classification. Continuous data sound is neutral across surfaces: no land/water filter modifier or reference drone remains. Entering land plays a 45 ms woody knock; entering water an 85 ms bright droplet. Audition both in “Brief shoreline notifications.” A toggle disables crossing sounds. Country boundaries do not trigger them. Source/geometry provenance and resolution limits are documented in `public/geography/manifest.json` and `docs/geography-validation.json`.

To reproduce the geographic mask, run `python scripts/prepare-geography.py --cache /absolute/cache`. Ordinary setup uses committed assets and needs no Python. Regenerate the user-facing source ZIP with `python scripts/package-source.py` after changing source files, before the production build.

Expanded map and land testing: use “Expand map” for a window-filling modal map; Expand requests browser fullscreen during the original click when permitted; blocked/unsupported requests retain the window-filling expanded view with a visible explanation and standalone-app link. “Return to standard view” restores the layout. Escape silences audio and closes the expanded dialog; native fullscreen exit restores the standard view and pauses audio. Expanded mode stretches the entire map independently to the remaining width and height, in landscape or portrait. It uses all available map space without cropping or square letterboxing. Geographic selection stays fixed and pointer sampling follows the stretched rectangle. Dataset selector and audio/silence controls remain available in expanded mode.

Select “Near-surface temperature · land + ocean” (NASA SVS 5147), or press “Land test · Sahara” to select it and go to 23° N, 15° E. “Water test · Atlantic” uses the same dataset at 30° N, 45° W. Both test real image-derived samples, not the unsampled-area reference guide. The ocean dataset remains selectable. Dataset loading clears the previous sample and pauses sound until movement/refocus; stale responses cannot overwrite the latest choice.

The temperature snapshot is frozen at 2026-10-29 09:00 UTC, transcribed from the frame's 05:00 EDT label. It is not live weather. Source description inconsistently says 2 m and 3 m sampling height; the model averaging interval is unresolved. Literal RGB palette matching preserves non-monotonic colors and gray endpoints; terrain shading means these are visual estimates, not measured Celsius. See `docs/temperature-source.md`. Reproduce committed assets with `python scripts/prepare-temperature.py --cache /absolute/cache`; a source hash prevents silently accepting updates from NASA's rolling frame directory.

Fullscreen correction: the dialog is explicitly fixed to the viewport, and the map is absolutely positioned inside an independently sized flex stage, avoiding intrinsic image-size feedback. Browser fullscreen is capability-checked and success is confirmed against fullscreenElement. A rejected request is reported visibly, not only in a screen-reader announcement. Browser/layout verification remains pending.

Temperature image provenance: `public/data/temperature-provenance.json` records the official full-resolution frame URL, 2048×1024 dimensions, hashes and decoded-pixel equality with a fresh NASA download. The source embeds its own logo and date; those pixels are masked from sampling. NASA separately lists 1024×512 print previews, 320×180 search previews and 80×40 thumbnails. The app now exposes the original frame link and clearly identifies this as a rendered visualization rather than a raw model grid.

Right-click the map to start audio at the clicked geographic location (standard or expanded view). It resumes exploration from a paused legend and keeps already playing audio on; it does not toggle audio off. The browser context menu is suppressed only inside the map. Start Audio remains keyboard-accessible, and Escape/Silence still stop immediately. If a dataset is loading, right-click announces that loading must finish first and does not start a stale value.

Temporal assets: run `python scripts/prepare-sequences.py --cache /absolute/cache` to reproduce the two small frozen sequences. Their source hashes are pinned; NASA rolling-directory changes fail verification. New frame derivatives use lossless WebP. A four-entry decoded frame cache prefetches one neighbor. Endpoint selection does not wrap, and failed frame loads leave no old value playing under a new timestamp.

Time narration is on by default after you start the experience (Start Audio, map right-click, or Read current data). “Speak time changes” independently controls automatic narration; turning it off immediately cancels active/queued speech without stopping data sound. Read current data is an explicit request and works even with automatic narration off. Speech includes the actual UTC timestamp, coordinates and image-derived visual value, never invented Celsius. Fast stepping cancels stale speech and debounces to the newest completed selection. Data sound ducks to 18% during speech, then restores.

Pause Audio stops the data tone while retaining the independent speech setting. Silence all audio, Escape, inactive tabs and fullscreen close cancel both app speech and data audio; subsequent automatic speech stays suppressed until Start Audio/right-click or an explicit Read current data action. Unsupported/failed speech falls back to accessible text. Browser, speech voices, listening and screen-reader behavior still require manual verification.

Branch policy for this session: `stable` preserves release 0.4.7 at 3a74a65; `main` contains milestones 5–6. Existing `text_to_speech` remains untouched; its coordinate phrasing (2cac0ce) was adapted in announcements.js, with new timeline cancellation and ducking behavior. When re-preparing assets, run prepare-sequences.py last so the complete sequence manifest follows the base first-frame scripts.
