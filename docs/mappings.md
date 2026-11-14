# Visual features and sound

This prototype uses a single attributed NASA visualization frame, not underlying model measurements. It reports no temperature in °C and makes no claim that a black pixel is a valid zero or a scientific missing flag.

## Coordinates and image

NASA frame 23000 is 2048×1024 RGB. Full image, no margins or label masks: source x=floor((longitude+180)/360×2048); y=floor((90−latitude)/180×1024). Clamp source endpoints. Wrap horizontal sample neighborhoods at the antimeridian; omit rows outside source bounds.

The source contains no GeoTIFF georeferencing. An independent Natural Earth 1:110m land comparison supports full-image equirectangular alignment: 99.4419% agreement on 1,619,197 pixels after excluding a five-pixel coastline neighborhood and latitudes beyond 80°. Eight geographic checkpoints agree. See `alignment.json`. Approximate alignment does not establish survey-grade coordinates. Milestone 4 adds a separately validated 1:50m land/lake mask for approximate surface cues (see below). Geographic names remain withheld; small islands and exact shorelines remain uncertain.

Display is a 1536×1536 Web Mercator resampling, nearest neighbor at pixel centers. Inverse display: longitude=360u−180; latitude=atan(sinh(π(1−2v))). Latitude limited to ±85.05112878°. Source extent: ±180° longitude, ±90° latitude. No stretching or cropping is added to the square display. Pointer uses its actual bounding rectangle at event time, handling offsets and resizing. Keyboard moves in degrees; east/west wraps and latitude clamps. Cursor is stored geographically so preferences and layout do not move it.

## Sampling

The original NASA legend, `sst_ecco2_cbar.png`, is sampled at row 50, inclusive columns 15–290, excluding the black border. Palette is ordered from cooler blue to warmer red, with 276 fixed RGB entries. Palette position is 0–1; duplicated colors resolve to the first matching entry.

For each source pixel, require opaque alpha, max RGB≥24, max−min≥20, and saturation (max−min)/max≥0.3. Normalize chromatic RGB by subtracting its minimum channel and dividing by chroma (max−min) and choose the nearest source-palette entry in Euclidean chromatic RGB. Reject distance>0.2. This approximates hue/color ordering under varying trace brightness. It cannot undo scientific compositing or reconstruct exact SST.

Sampling radius defaults to 2: a 5×5 source-pixel square. Options 1 and 4 produce 3×3 and 9×9. This is a pixel neighborhood, not a fixed physical area; its geographic size varies with latitude. The mean is the unweighted arithmetic mean palette position over qualifying pixels in this neighborhood at the selected NASA frame time. It is not a geographic or temporal mean temperature. No temporal average is computed; the original model averaging interval is unverified.

Density is qualifying trace pixels divided by all available pixels in the square. A threshold can exclude dim traces; zero trace coverage means no interpretable visual sample. It does not establish physical absence, measured zero or scientific missing data. All thresholds are constant and available in `sampling.js`; normalization never follows per-frame minima/maxima.

## Audio — continuous harmonic synth (current revision)

For mean palette position q, pitch = lowHz×(highHz/lowHz)^q (default 160–800 Hz). Gain remains 0.12×volume×density. Defaults and pitch/gain smoothing (55 ms) are retained. A valid q=0 remains a real low value. No qualifying pixels means null data pitch and zero data-tone gain, without automatic missing-sample or shoreline beeps.

The native Web Audio synth in `synth-voice.js` uses a normalized additive PeriodicWave with harmonic weights [1, .32, .18, .10, .05] at multiples of the data fundamental. It is a sustained, filtered pad voice, not an unmodulated sine beep. No external synthesizer library is required for this revision. Surface is a continuous low-pass filter modifier on the same voice: cutoff = fundamental×(3−1.5×contrast) over water and fundamental×(3+4×contrast) over land. Unknown surface uses ×3. Clamp cutoff to 100–10000 Hz, Q=0.55, with a 180 ms smoothing time constant. Surface contrast defaults to 65%; 0% makes the two filters identical. The oscillator never restarts on a shoreline crossing. Filtering changes perceived brightness/loudness; listening checks are still needed to assess comfort. Pitch remains solely data-driven.

When no visual sample exists, a separate optional quiet harmonic reference at fixed 140 Hz and gain 0.05×volume carries the same geographic filter. This is a surface guide, not invented data. Unknown surface disables it. “Surface guide in unsampled areas” toggles it. Land/water transition notifications and their control have been removed at the user's request. The retained geographic transition utility is not connected to audio.

Edge/corner rhythms remain distinguishable in mono, using softer filtered mallet voices with harmonic weights [1,.22,.38,.08,.12], attack up to 50 ms and release across the final 60% of each note. Minimum note duration is 160 ms; short rhythmic strokes may overlap. Boundary gain is 0.065×volume. New boundary cues replace queued ones. No repeated gap notifications interrupt exploration. An explicit no-sample legend example is a single soft 110 Hz filtered swell; it is not played automatically.

Reference legend includes pitch, density, water/land filters, a single held-note water→land→water filter morph, unsampled-area guide, and all eight boundary sounds. Examples pause exploration; movement/refocus resumes it. Silence/Escape closes master gain immediately, cancels every scheduled voice and invalidates pending starts. Volume changes cancel queued cues. Pointer exit fades data/guide voices; its edge cue may finish. Tab inactivity silences everything and requires explicit restart.

Screen-reader spatial feedback debounces for 450 ms. No application TTS or timeline is implemented yet. Browser, listening and screen-reader verification remain outstanding because the managed browser tool is unavailable.

## Geographic classification (milestone 4)

`public/geography/manifest.json` pins Natural Earth land and lake GeoJSON to commit ca96624a56bd078437bca8184e78163e5039ad19 and records SHA-256 hashes. These sources are public domain. The raster union preserves each polygon's holes; lake coverage is subtracted from land. An island inside a lake remains land where the underlying land polygon covers it. Countries are not inputs. Geography does not inspect NASA pixel colors.

`surface-mask.bin` is 4096×2048 equirectangular cells, packed row-major at one bit per cell (MSB first, land=1/water=0): 1,048,576 bytes. Fetch checks both SHA-256 and dimensions. Each cell is 0.087890625° across, about 9.8 km at the equator; east-west ground width shrinks toward poles. Integer-vertex polygon rasterization introduces up to roughly one-cell boundary error in addition to source generalization. The source is current generalized geometry, not a reconstruction of 2007 shorelines. Small islands, narrow waterways and seasonal shorelines can be missing. Surface readout refers to the cursor cell, independent of the image-sampling neighborhood.

`docs/geography-validation.json` compares the independent mask to rendered NASA gray land: 99.7268% agreement over the tested non-coastal, non-polar region, twelve expected surface checkpoints, and four restricted coastline transects with nearest-edge errors of [1,0,0,0] original source pixels. This supports approximate overlay alignment; it does not establish global one-pixel accuracy. Real tests cover Lake Victoria, Lake Superior, Caspian Sea, Madagascar, Japan, Britain and Manitoulin Island in Lake Huron.

Generate reproducibly with `python scripts/prepare-geography.py --cache /absolute/cache` (Pillow/NumPy). Missing, corrupt or unsupported geography leaves surface unknown, suppresses surface guide/crossings, and retains data tones and map-boundary cues. The UI offers an independent geometry retry.

## Visible map boundaries

A 12 CSS-pixel inner zone detects left/right/top/bottom and all four corners, based on the actual resized map rectangle. An 18-pixel release zone suppresses jitter and re-arms after leaving. Corners override constituent edges. Leaving a corner along one edge does not repeat that edge. No sound repeats while stationary. Pointer exit clips the latest observed segment to the rectangle and signals the exit edge/corner even if motion skipped the inner zone; pointer re-entry re-arms. These are map-element boundaries, not physical monitor edges, which browsers cannot reliably detect.

Mono patterns (panning is unnecessary):
- Left: one 330 Hz note, 220 ms.
- Right: three 660 Hz notes, at least 160 ms each (overlapping release tails), onsets 0/120/240 ms.
- Top: 660 then 880 Hz, at least 160 ms notes, 170 ms onset spacing.
- Bottom: 440 then 330 Hz, same timing.
- Corners: vertical pattern followed by horizontal pattern starting at 420 ms.

Boundary patterns use the harmonic mallet envelopes described above. A preference toggles boundary cues; shorelines only modify the continuous filter. Silence, Escape and tab inactivity cancel every cue and both continuous voice groups.

## Dataset and expanded viewport revision

Ocean chromatic matching remains unchanged. SVS 5147 uses literal RGB matching because its temperature palette is not monotonic in hue; see `temperature-source.md`. Location and preferences survive source changes; frame, palette, metadata and timestamp commit together behind a request-generation guard. A failed new load cannot allow an older response to commit.

Expanded view uses a native modal dialog and optionally the browser Fullscreen API. The existing map element is moved, not cloned. Native dialog focus containment leaves background controls inert; expanded audio controls proxy the same engine. On close, focus returns to Expand map. The full map is always visible: choose a square size equal to min(available stage width, available stage height), center it, and use object-fit:contain. The map's geographic viewport is always [0,1] on both Mercator axes; no vertical crop or camera recentering is applied. Margins belong to the stage, outside the interactive map, so pointer and boundary cues use only the fitted square. Resize/expand/restore preserve latitude/longitude. Escape retains emergency silence behavior; fullscreen exit also pauses audio.

Fullscreen correction supersedes the earlier two-step fullscreen description: Expand requests browser fullscreen within its click gesture when permitted. A fixed, inset modal with an independently sized flex stage and absolutely positioned map remains available when native requests fail. Capability/failure messages are visible; the standalone-app link offers a different browser context. Native fullscreen exit restores the normal view, pauses audio and returns focus. Success is never inferred merely from a resolved request promise; fullscreenElement must identify the dialog.
