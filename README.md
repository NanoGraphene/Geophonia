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

Source: NASA SVS 3912, ECCO2 ocean visualization; frame 23000 at 2007-03-25 12:00 UTC. Each dataset currently has one frozen frame; manual time travel remains pending. See `public/data/source-manifest.json`, `docs/alignment.json`, `docs/milestones.md`, and `docs/mappings.md`.

Focus map with Tab; arrows move by selected degree step, Home resets. Pointer and coordinate form share the same location. The map is a localized ARIA application region; Tab leaves normally. Directional buttons offer an alternative. Web Mercator latitude range is ±85.0511°. East/west navigation wraps across the antimeridian.

Start Audio begins sonification; Pause or Silence all audio stops it. Escape silences immediately. Volume defaults to 25%, pitch 160–800 Hz. Missing visual samples have zero data tone and no background guide. Shoreline crossings have short knock/droplet notifications. The audio legend demonstrates pitch, trace coverage, missing-sample reference, and both shoreline crossing notifications. Background tabs require explicit audio restart.

Feature definitions, thresholds, projection and lifecycle: `docs/mappings.md`. Verification limits and demo: `docs/accessibility-checks.md`. Milestones 2–4 are implemented. This branch adds fresh optional natural narration directly from stable; the timeline remains pending.

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

## Natural narration (0.4.8)

`natural-tts` starts directly at stable commit `3a74a65` (0.4.7). It does not incorporate the `text_to_speech` experiment or the later timeline/browser-TTS implementation. GitHub main, stable, and the test branch are preserved.

KittenTTS Nano INT8 (15M parameters) generates English speech on-device in a dedicated classic worker. Click the Bella sample to audition the actual model output without loading weights, then Load natural voice. The pinned model and voice assets are approximately 25 MB; first use also fetches the approximately 13 MB self-hosted WASM runtime and English pronunciation dictionaries. Cache reuse depends on browser storage. The upstream browser SDK is a developer preview, vendored and pinned; optional analytics are disabled. No API key is required, and narration text/audio is not uploaded. Asset requests still contact Hugging Face and the pinned espeak-ng dictionary URLs.

Read current data, Read location and Describe dataset are explicit actions. Movement, dataset changes, Escape, tab hiding and Silence cancel playback and suppress late results. Only the latest queued reading is generated after an in-flight reading finishes; stopping prevents playback but does not interrupt synchronous WASM inference already underway. Map sounds duck during narration; the main volume controls generated narration as well as sonification. Browser speech is available only through an explicit fallback selection; it follows the platform’s voice and network behavior. Expanded mode includes Read current data and Silence all audio.

`npm run dev` / `npm run build` prepare matching ONNX runtime assets from the exact pinned npm dependency. Generated runtime files are ignored and omitted from the source ZIP. `npm run voice:verify` (Node 24 with `--use-env-proxy`) regenerates the committed Bella preview using the same pinned SDK, model and runtime. It writes actual inference measurements to `docs/natural-voice-verification.json`. Cache files live under the OS temporary directory.

Model and dependency revisions, hashes and licensing: `public/neural/provenance.json` and `public/vendor/NOTICE.txt` with bundled license files.

67 automated checks pass, including stale-result suppression, explicit fallback, worker queue replacement, playback errors, mute-safe ducking, scientific wording and existing stable regressions. Actual Node/WASM inference succeeds. Browser playback, mobile performance, screen-reader behavior and subjective voice quality still need manual verification; browser-control tooling is unavailable in this environment.
