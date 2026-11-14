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
- **2** reads the estimated temperature and unit, for example “Approximately 23 degrees Celsius. An estimate from image color.”
- **3** reads the selected NASA frame date and time in UTC.
- **Left/Right** selects the previous/next available frame, preserving the geographic cursor.
- **Shift+Left/Right** moves west/east on the focused map; **Up/Down** moves north/south. **Home** on the map resets location. Direction buttons and coordinate entry remain alternatives.
- **Home/End** on either time slider selects the first/last frame.
- **Escape / Silence all audio** stops speech and sonification. A new reading replaces the previous one. Holding a number key does not repeat speech.

Shortcuts respect text fields, selects, editable content and other range controls. The Spoken shortcuts checkbox disables the single-key speech commands and spoken output; reading buttons still expose text. Speech requires a supported browser. It starts through the browser Speech Synthesis API with no application model download; available natural/enhanced English voices are preferred, and the user can select any available English voice and speed. Actual quality, first-use latency and network behavior are controlled by the browser/OS voice. A voice that sounds better than Daniel cannot be guaranteed on every device. Voices arriving asynchronously update the automatic choice while preserving a manual selection.

The earlier Kitten experiment remains in the `natural-tts` branch history. This revision (`speech-shortcuts-timeline`, 0.5.0) replaces its model-loading controls and removes its SDK/runtime dependency from the deployed app. It retains the stable-based map/audio implementation and does not merge the experimental `text_to_speech` branch.

## Data and dates

Two frozen NASA visualizations, each with three available frames:

| Source | Available UTC frame times | Temperature-color scale |
| --- | --- | --- |
| SVS 3912, ECCO2 ocean currents and temperature | 25 March 2007, 12:00 / 16:07 / 20:15 | 0–32 °C |
| SVS 5147, GEOS-FP near-surface temperature, land + ocean | 29 October 2026, 09:00 / 10:00 / 11:00 | −40–40 °C |

These are rendered images, not raw scientific model grids or live weather. The Celsius readout linearly converts source palette position to the source legend range, rounds to whole degrees and explicitly labels the result an image estimate. Terrain shading, repeated palette colors, generalized geography and source resolution limit accuracy. Missing/unmatched pixels are not temperature zero. Source normalized palette position still drives data pitch; trace/color coverage drives loudness and is not current speed. Scientific model averaging intervals are unverified. Temperature sampling height is inconsistently described as 2 m and 3 m by the source.

Slider input, time buttons and keyboard time selection load both the selected original-resolution sampling frame and its matching Mercator display frame. They commit together with timestamp and resampled value. Latest-request guards reject stale results/errors; failed loads clear values and offer Retry. A bounded frame cache shares in-flight loads and permits retry. Sonification fades while loading and resumes at the same geographic point if audio remains enabled. No temporal interpolation, automatic playback or additional dates are implied.

## Geographic names and audio

Country polygons (Natural Earth 1:50m), marine areas (1:10m) and lakes (1:50m) are committed as local, integrity-checked geometry. Lookup retains polygon holes, uses specific marine regions before broad oceans, and reports unavailable/unmapped locations explicitly. Boundaries are approximate present-day geography, not historical or authoritative border claims. See `public/geography/place-names-manifest.json` for the pinned revision and upstream hashes.

Right-click on the map starts data audio. The neutral harmonic data tone remains identical over land and water. Entering land plays a 45 ms knock; entering water an 85 ms droplet, with spatial hysteresis to suppress shoreline jitter. Map-edge cues remain distinct. Speech ducks the map audio while speaking; completion, cancellation and errors restore its level without reopening a muted master. Volume defaults to 25%. Backgrounding the page silences audio and requires an explicit new action.

Expanded view stretches the full map to the available width and height without cropping, preserving geographic selection and pointer alignment. Both time sliders stay synchronized. Expanded speech buttons, keyboard shortcuts and Silence remain available; the standard timeline is hidden while the map is expanded. Fullscreen restrictions retain the viewport-filling dialog and visible fallback message.

## Verification and reproduction

82 automated checks pass: country/sea/ocean checkpoints and antimeridian handling, polygon holes and provenance hashes, voice preference/async discovery, cancellation/mute/error handling, scientific wording, shortcut conflicts, distinct real frame assets, actual time-varying source patches, source decode/retry, stale frame selection, and existing stable map/geography/audio regressions. Browser playback, visual layout, subjective voice quality and screen-reader behavior remain unverified here because the managed browser-control tool is unavailable. See `docs/accessibility-checks.md` for manual checks.

Assets are committed; ordinary setup requires no Python. Asset reproduction uses Python with Pillow and NumPy. Run `scripts/prepare-assets.py`, `scripts/prepare-temperature.py`, `scripts/prepare-geography.py`, `scripts/prepare-sequences.py`, and `scripts/prepare-place-names.py`, each with `--cache /absolute/cache`, as needed. Source/sequence hashes prevent silently accepting changed NASA frames. Regenerate `python scripts/package-source.py` before building to refresh the runnable source ZIP.

The existing owner-private Site is published through the Sites plugin. In this managed environment its filesystem helpers/browser control are unavailable, so source sync and packaging use ordinary authenticated Git and a tar archive of the exact built output plus `.openai/hosting.json`. GitHub feature branches remain independently reviewable. No credentials are stored in source.
