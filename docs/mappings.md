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

## Audio

For mean palette position q, pitch = lowHz×(highHz/lowHz)^q (default 160–800 Hz). Palette position and density clip to [0,1]. Low and high must lie within 80–2000 Hz with low<high. Audio gain = 0.12×volume×density (default volume 0.25, peak gain≤0.03). Pitch and gain use AudioParam.setTargetAtTime with a 55 ms time constant. No stereo headphones required; sound is centered.

A valid q=0 remains audible at lowHz. No qualifying pixels yields null q, no continuous tone and two 110 Hz, 75 ms sine pulses separated by 95 ms, once on entry. Repeated motion within this state does not retrigger. Returning to valid samples cancels queued cue pulses. Milestone 4 classifies the surface independently and crossfades water sine / land triangle timbres for data tones. No scientific value is invented on land: when no visual sample exists, the data-tone gain remains zero. A separate optional quiet surface guide is described below.

The legend demonstrates current configured low/mid/high pitch, 20/50/100% trace coverage, missing visual sample, both surface timbres, the reference surface guide, both shoreline transitions, and all eight boundary patterns. Legend replaces exploration sound; new examples cancel older ones. Resume by moving/refocusing the map. Each legend action is an explicit audio-start gesture. Volume zero silences everything without changing sample validity.

## Lifecycle and accessibility

AudioContext is created only after Start Audio or a legend action. Start handles unsupported APIs and resume errors. Pause, Silence all audio and Escape synchronously close the master gain and invalidate pending starts, cancel examples/cues, then suspend the context. Returning to the tab does not start audio automatically.

Pointer leave/cancel fades data and surface guide sound with a 40 ms time constant and cancels missing-sample pulses. On pointer exit, the last segment is clipped to the map rectangle so its edge/corner cue may finish. Pointer cancellation cancels all pending cues. Keyboard movement/refocusing and coordinate buttons activate exploration at the preserved selected location. Moving keyboard focus to settings leaves selection and sound stable. Background tabs and pagehide silence audio and require explicit restart. Browser audio interruptions reset the UI to off.

Map is one localized role=application region to receive arrows with a screen reader; Tab exits it. Directional buttons and numeric entry offer native-control alternatives. Incidental position announcements debounce for 450 ms to avoid a queue. No application speech synthesis is included; use the accessible text/readout. Native screen-reader compatibility still requires manual verification.

## Geographic classification (milestone 4)

`public/geography/manifest.json` pins Natural Earth land and lake GeoJSON to commit ca96624a56bd078437bca8184e78163e5039ad19 and records SHA-256 hashes. These sources are public domain. The raster union preserves each polygon's holes; lake coverage is subtracted from land. An island inside a lake remains land where the underlying land polygon covers it. Countries are not inputs. Geography does not inspect NASA pixel colors.

`surface-mask.bin` is 4096×2048 equirectangular cells, packed row-major at one bit per cell (MSB first, land=1/water=0): 1,048,576 bytes. Fetch checks both SHA-256 and dimensions. Each cell is 0.087890625° across, about 9.8 km at the equator; east-west ground width shrinks toward poles. Integer-vertex polygon rasterization introduces up to roughly one-cell boundary error in addition to source generalization. The source is current generalized geometry, not a reconstruction of 2007 shorelines. Small islands, narrow waterways and seasonal shorelines can be missing. Surface readout refers to the cursor cell, independent of the image-sampling neighborhood.

`docs/geography-validation.json` compares the independent mask to rendered NASA gray land: 99.7268% agreement over the tested non-coastal, non-polar region, twelve expected surface checkpoints, and four restricted coastline transects with nearest-edge errors of [1,0,0,0] original source pixels. This supports approximate overlay alignment; it does not establish global one-pixel accuracy. Real tests cover Lake Victoria, Lake Superior, Caspian Sea, Madagascar, Japan, Britain and Manitoulin Island in Lake Huron.

Generate reproducibly with `python scripts/prepare-geography.py --cache /absolute/cache` (Pillow/NumPy). Missing, corrupt or unsupported geography leaves surface unknown, suppresses surface guide/crossings, and retains data tones and map-boundary cues. The UI offers an independent geometry retry.

## Timbre and separate reference guide

Water uses a sine waveform; land a triangle waveform. Two running voices crossfade at the same mapped data pitch, using the existing 55 ms smoothing. Triangle gain is multiplied by sqrt(1.5) to match ideal waveform RMS to a sine; comparable perceived loudness still needs listening validation. Country crossings cannot change the timbre. Surface selection is geographic, so a later time change at the same location cannot itself change land/water classification.

When there is no visual sample and the surface is known, an optional separate reference voice plays at fixed 140 Hz and base gain 0.05×volume, with the same land/water timbre. It defaults on and can be switched off with “Surface guide in unsampled areas.” The missing-sample cue still announces entry, and the DATA tone stays at zero. This reference is not sampled temperature, density or a fabricated value. At default volume, its nominal gain is 0.0125 (before triangle RMS compensation). Unknown surface suppresses it. Legend examples explicitly distinguish this reference from data mapping.

## Shoreline transitions and paths

The surface readout follows the selected mask cell. “Near mapped shoreline” indicates that its 3×3 cell neighborhood contains both surfaces. Crossing cues hold the previous stable side until the cursor enters a uniform 3×3 neighborhood on the other side. This spatial hysteresis suppresses stationary and near-edge jitter; it can omit crossing cues for islands/channels narrower than three cells, even when the raw classification changes. Timbre crossfades to the selected cell's surface rather than falsifying the readout to match the cue hysteresis.

Between successive observed pointer positions, assume a straight path in the displayed Mercator map. Calculate fractions at every crossed geographic raster row/column boundary and classify each intervening cell. This detects an island's entry and exit even if a fast movement starts and ends on water. Unobserved curved motion cannot be reconstructed. Keyboard longitude wrap uses the shortest antimeridian segment; pointer motion across the map does not wrap. Pointer re-entry, focus changes, coordinate teleports and resets establish baselines without tracing unseen travel. Non-spatial resampling (radius/preferences or future time changes) never invokes crossing detection.

Entering land: 740 then 988 Hz; entering water: 988 then 740 Hz. Notes are 65 ms long, with 85 ms onset spacing. Latest navigation replaces older navigation notes; at most the two most recent crossings per observed movement are sonified (full crossing count remains in text). This preserves a rapid island entry/exit without unbounded audio backlog. Boundary pattern, if present, plays first. Navigation cancels overlapping missing-sample pulses. Changing volume cancels pending cues, including volume-zero changes outside the map. Disabling a cue preference cancels queued navigation sounds.

## Visible map boundaries

A 12 CSS-pixel inner zone detects left/right/top/bottom and all four corners, based on the actual resized map rectangle. An 18-pixel release zone suppresses jitter and re-arms after leaving. Corners override constituent edges. Leaving a corner along one edge does not repeat that edge. No sound repeats while stationary. Pointer exit clips the latest observed segment to the rectangle and signals the exit edge/corner even if motion skipped the inner zone; pointer re-entry re-arms. These are map-element boundaries, not physical monitor edges, which browsers cannot reliably detect.

Mono patterns (panning is unnecessary):
- Left: one 330 Hz note, 220 ms.
- Right: three 660 Hz notes, 65 ms each, onsets 0/120/240 ms.
- Top: 660 then 880 Hz, 120 ms notes, 170 ms onset spacing.
- Bottom: 440 then 330 Hz, same timing.
- Corners: vertical pattern followed by horizontal pattern starting at 420 ms.

All cue patterns have attack/release ramps and nominal gain 0.1×volume. Preferences independently toggle shoreline and boundary cues. Silence, Escape and tab inactivity cancel every cue and both continuous voice groups.
