# Geophonia — Earth Information Jukebox

Accessible NASA Space Apps 2026 prototype. Independent submission; no NASA endorsement.

## Run

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev
npm test
npm run check
npm run build
npm run preview
```

Browser JavaScript ES modules with Vite as the only direct dependency. No TTS model, runtime weights, backend credentials or geocoding service are required.

## Keyboard and speech

- **1** reads the country, ocean, sea or named inland lake at the geographic cursor.
- **2** reads the selected value and unit, for example “Approximately 23 degrees Celsius. An estimate from image color.”
- **3** reads the selected NASA frame date and time in UTC.
- **Left/Right** selects the previous/next available frame, preserving the geographic cursor.
- **Shift+Left/Right** moves west/east on the focused map; **Up/Down** moves north/south. **Home** on the map resets location. Direction buttons and coordinate entry remain alternatives.
- **Home/End** on either time slider selects the first/last frame.
- **Escape / Silence all audio** stops speech and sonification. A new reading replaces the previous one. Holding a number key does not repeat speech.

Shortcuts respect text fields, selects, editable content and other range controls. The Spoken shortcuts checkbox disables the single-key speech commands and spoken output; reading buttons still expose text. Speech requires a supported browser. It starts through the browser Speech Synthesis API with no application model download; available natural/enhanced English voices are preferred, and the user can select any available English voice and speed. Actual quality, first-use latency and network behavior are controlled by the browser/OS voice. A voice that sounds better than Daniel cannot be guaranteed on every device. Voices arriving asynchronously update the automatic choice while preserving a manual selection.

The earlier Kitten experiment remains in the `natural-tts` branch history. The keyboard revision (`speech-shortcuts-timeline`, 0.5.0) replaces its model-loading controls and removes its SDK/runtime dependency from the deployed app. It retains the stable-based map/audio implementation and does not merge the experimental `text_to_speech` branch.

## Data and dates

The original two frozen NASA visualizations each have three available frames:

| Source | Available UTC frame times | Temperature-color scale |
| --- | --- | --- |
| SVS 3912, ECCO2 ocean currents and temperature | 25 March 2007, 12:00 / 16:07 / 20:15 | 0–32 °C |
| SVS 5147, GEOS-FP near-surface temperature, land + ocean | 29 October 2026, 09:00 / 10:00 / 11:00 | −40–40 °C |

These are rendered images, not raw scientific model grids or live weather. The original temperature layers convert source palette position to source legend units, round to whole degrees and explicitly label image estimates. Other profiles use their own units and verified linear, logarithmic or nonuniform tick calibration. Terrain shading, repeated palette colors, generalized geography and source resolution limit accuracy. Missing/unmatched pixels are not temperature zero. Source normalized palette position still drives data pitch; trace/color coverage drives loudness and is not current speed. Scientific model averaging intervals are unverified. Temperature sampling height is inconsistently described as 2 m and 3 m by the source.

Slider input, time buttons and keyboard time selection load both the selected original-resolution sampling frame and its matching Mercator display frame. They commit together with timestamp and resampled value. Latest-request guards reject stale results/errors; failed loads clear values and offer Retry. A bounded frame cache shares in-flight loads and permits retry. Sonification fades while loading and resumes at the same geographic point if audio remains enabled. No temporal interpolation, automatic playback or additional dates are implied.

## Geographic names and audio

Country polygons (Natural Earth 1:50m), marine areas (1:10m) and lakes (1:50m) are committed as local, integrity-checked geometry. Lookup retains polygon holes, uses specific marine regions before broad oceans, and reports unavailable/unmapped locations explicitly. Boundaries are approximate present-day geography, not historical or authoritative border claims. See `public/geography/place-names-manifest.json` for the pinned revision and upstream hashes.

Right-click on the map starts data audio. The neutral harmonic data tone remains identical over land and water. Entering land plays a 45 ms knock; entering water an 85 ms droplet, with spatial hysteresis to suppress shoreline jitter. Map-edge cues remain distinct. Speech ducks the map audio while speaking; completion, cancellation and errors restore its level without reopening a muted master. Volume defaults to 25%. Backgrounding the page silences audio and requires an explicit new action.

Expanded view stretches the full map to the available width and height without cropping, preserving geographic selection and pointer alignment. Both time sliders stay synchronized. Expanded speech buttons, keyboard shortcuts and Silence remain available; the standard timeline is hidden while the map is expanded. Fullscreen restrictions retain the viewport-filling dialog and visible fallback message.

## Verification and reproduction

82 automated checks pass: country/sea/ocean checkpoints and antimeridian handling, polygon holes and provenance hashes, voice preference/async discovery, cancellation/mute/error handling, scientific wording, shortcut conflicts, distinct real frame assets, actual time-varying source patches, source decode/retry, stale frame selection, and existing stable map/geography/audio regressions. Browser playback, visual layout, subjective voice quality and screen-reader behavior remain unverified here because the managed browser-control tool is unavailable. See `docs/accessibility-checks.md` for manual checks.

Assets are committed; ordinary setup requires no Python. Asset reproduction uses Python with Pillow and NumPy. Run `scripts/prepare-assets.py`, `scripts/prepare-temperature.py`, `scripts/prepare-geography.py`, `scripts/prepare-sequences.py`, and `scripts/prepare-place-names.py`, each with `--cache /absolute/cache`, as needed. Source/sequence hashes prevent silently accepting changed NASA frames. Optional `python scripts/package-source.py` creates a local runnable source ZIP under ignored `work/`. The app links to the GitHub branch source archive so the full source download is not constrained by static-host per-file limits.

The existing owner-private Site is published through the Sites plugin. In this managed environment its filesystem helpers/browser control are unavailable, so source sync and packaging use ordinary authenticated Git and a tar archive of the exact built output plus `.openai/hosting.json`. GitHub feature branches remain independently reviewable. No credentials are stored in source.

## Dataset-agnostic revision 0.6.0

Branch `dataset-agnostic` builds on the completed 0.5.0 keyboard/timeline revision. All geographic sampling, source metadata, feature decoding, source-unit speech and sound mapping now use dataset profiles rather than dataset-ID branches. See `docs/dataset-model.md` for the manifest and sample contracts, supported projections, calibration and importer limits.

The catalog has nine usable 2D profiles: the two temperature sources, four separate full-world GEOS-FP air-quality layers (PM2.5, ozone, CO, NOx), flat annual night-light maps, categorical aerosols and flat SOS lightning textures. Air-quality layers are linked alternatives from NASA 5533, not the original GEOS-CF composite with interleaved variable strips. Night lights use 2012/2018/2023 annual labels. Aerosols and each air-quality layer are one frozen frame. Lightning offers three ordered animation frames with scientific dates explicitly unverified. Brightness, color strength and mark coverage are visual indices, never fabricated concentration or event-count units. Source assets and empirical alignment details are pinned in `docs/additional-datasets.json`; all derived assets are local.

CO₂ 5196, GEDI 4950, atmospheric rivers 4960 and Perpetual Ocean 2 5425 currently provide globe/camera/3D assets in the assessed resources. They are documented in the app as requiring a verified flat geographical layer; those views are not silently mapped to Mercator. The same local numeric-grid importer can use a suitable 2D source later. Caldwell is a reference sonification, not an Earth-map dataset.

Choose the Aerosols variable selector to hear one species’ visible color strength. Automatic mapping follows profile units/ranges, including nonuniform and logarithmic source legends. Pitch range, value range, response curve and amplitude source are adjustable. Defaults and overrides remain fixed across dates and never refit per cursor/frame.

“Add your own 2D grid” imports a regular lat/lon CSV entirely in the tab. Column names and a whole-sequence value range are detected; users confirm variable, units, time and missing marker. Missing cells and true zeros remain distinct. Numeric grids render on a separate geographic context map, preserving coverage and exact cell centers. The example CSV is explicitly synthetic. Reprojection/regridding is required before importing other coordinate systems/irregular observations. No GeoTIFF/NetCDF/3D importer is claimed.

102 automated checks pass, including 10 CSV cases, profile calibration/projection/zero/category/brightness cases, physical-unit speech, selectable pitch/amplitude mapping, real NASA patch/asset integrity checks, and previous keyboard/time/map/audio/geography regressions. A 1024-square numeric-grid render was exercised in Node (~100 ms on this host); this is not browser QA. Browser playback, subjective voice quality, visual layout and screen readers remain manually unverified.

Reproduce new NASA layers with `python scripts/prepare-additional-datasets.py --cache /absolute/cache` (Pillow, NumPy and ffmpeg required only for reproduction). It checks original hashes; rolling URLs that change must be assessed explicitly. Task ownership: root integrated profile model, sampler, rendering, mapping and UI; CSV agent implemented the standalone parser/importer with tests; asset agent prepared verified 2D assets and provenance.
