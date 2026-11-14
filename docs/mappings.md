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

## Audio — neutral data voice and short crossing notifications (current)

Mean palette position q sets pitch = lowHz×(highHz/lowHz)^q; coverage sets gain = 0.12×volume×density, with existing 55 ms smoothing. The sustained harmonic voice has the same voicing everywhere (partial weights [1,.32,.18,.10,.05], neutral low-pass cutoff fundamental×3 clamped to 100–10000 Hz, Q=.55). Geography never changes its filter or waveform. The constant surface modifier, contrast setting, and 140 Hz background guide have been removed. Missing data has zero continuous data gain and no automatic gap beep.

Land/water classification independently triggers short mono earcons on spatial shoreline crossings:
- Entering land: dry, low knock; partial weights [1,.7,.45,.3,.2,.1]; pitch slides from 330 to 220 Hz over the first 75% of a 45 ms envelope.
- Entering water: brighter droplet; partial weights [1,.12,.03]; pitch slides from 1400 to 650 Hz over the first 75% of an 85 ms envelope.
- Both use 3 ms attack, 6 ms hold point then release to zero by the end. Peak gain is 0.12×volume for land, 0.10×volume for water. Stops disconnect 10 ms after the audible envelope reaches zero.

The independent SurfaceTransitionTracker requires a uniform 3×3 mask-cell neighborhood on the new side. This spatial hysteresis suppresses stationary and near-coast jitter; small features can classify without producing a cue. Every raster cell crossed along each observed Mercator segment is checked, so rapid travel across a mapped island can yield both entry and exit. Keyboard wrapping follows the short antimeridian route. Pointer re-entry, focus/start, resets and coordinate jumps establish baselines without manufacturing travel; non-spatial resampling does not trigger crossings. Country borders are not inputs.

At most the two most recent crossings from a movement are queued, spaced 100 ms apart, so a pair completes within 185 ms. New crossings cancel older pending crossing notes. A simultaneous map-boundary cue starts after that short pair; map-edge patterns retain their separate harmonic mallet sound. Crossing and boundary toggles independently suppress their respective cues; disabling either cancels pending navigation notes. Missing data does not suppress genuine geographic crossings.

Legend buttons audition entering-land and entering-water sounds individually. Reference examples pause exploration; moving/refocusing resumes it. Silence/Escape and inactive tabs cancel all voices and cues. Volume changes cancel queued notes, including zero-volume changes. Pointer exit fades the data voice; a brief crossing/exit cue may finish. No background guide remains.

Automated waveform/envelope/cancellation and geographic path tests pass. Sound recognizability, loudness comfort, real browser behavior and screen-reader usability remain unverified without manual listening/browser access. Timeline and optional application TTS are implemented as described below.

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

Expanded view uses a native modal dialog and optionally the browser Fullscreen API. The existing map element is moved, not cloned. Native dialog focus containment leaves background controls inert; expanded audio controls proxy the same engine. On close, focus returns to Expand map. The full map is always visible and now stretches independently to the stage width and height at the user's request. object-fit:fill and an unconstrained map aspect ratio remove square letterboxing without cropping. The geographic viewport remains [0,1] on both Mercator axes. Pointer/cursor conversion normalizes against the actual stretched rectangle, so the displayed location, sampling and boundary cues stay aligned. Resize/expand/restore preserve latitude/longitude. Escape retains emergency silence behavior; fullscreen exit also pauses audio.

Fullscreen correction supersedes the earlier two-step fullscreen description: Expand requests browser fullscreen within its click gesture when permitted. A fixed, inset modal with an independently sized flex stage and absolutely positioned map remains available when native requests fail. Capability/failure messages are visible; the standalone-app link offers a different browser context. Native fullscreen exit restores the normal view, pauses audio and returns focus. Success is never inferred merely from a resolved request promise; fullscreenElement must identify the dialog.

## Timeline (milestone 5)

Both datasets expose three explicit UTC timestamps. Ocean intervals are 247 and 248 minutes, from NASA's frame-date table; temperature times come from embedded EDT labels converted to UTC. This is a frozen, manual sequence, not automatic playback or live weather. Each dataset retains one fixed palette, mask and normalization across all frames. Timestamps indicate source frame time; scientific averaging intervals remain unverified.

The timeline is a native range plus Previous/Next buttons, with Left/Right/Home/End behavior scoped to timeline focus. Position, audio preferences and surface classification do not change when time changes. Map keys still move geographically. Pending requests clear sampled value and fade audio; only the newest successfully decoded source and display image commit together with sampled value/timestamp. Failures stay unavailable, allow retry and do not revive stale loads. Cache capacity is four decoded frame objects; a single neighbor is prefetched without committing, speaking or changing selection.

## Time-change speech (milestone 6)

Narration starts only after an explicit experience action and speaks a committed snapshot: actual UTC source date/time, spelled-out coordinates, variable/visual feature, normalized image-derived value and coverage. Missing visual samples are described without fabricating scientific zeros or measurements. No scientific units are asserted for image-derived palette position. Underlying source averaging intervals remain unverified.

The default-on Speak time changes preference is separate from data Pause. Toggle off cancels active and scheduled narration immediately; toggle on applies to future time changes. Read current data explicitly reads the current committed snapshot even if automatic speech is off. If loading/failed, it reports not ready rather than using an old frame. Silent global controls cancel every speech/tone and suppress future automatic narration until an explicit Start/read. Browser speech availability and errors have text fallback.

Every requested source/time selection cancels previous narration before loading. Only the latest successful commit can request a new utterance; a 180 ms speech debounce prevents rapid key-repeat backlog. Old utterance callbacks carry generation IDs and cannot unduck or emit fallback over newer speech. Spatial movement also cancels stale snapshot speech. The app clears pending spatial live-region text and avoids its own duplicate value announcements while TTS handles the change. Native screen-reader control announcements are outside the app's speech control.

Speech onstart lowers a dedicated output bus to 0.18 using 30 ms smoothing; end/error/cancel restores it to 1. Master mute remains closed after global silence regardless of late speech events. Speech synthesis itself is browser-managed, separate from data volume. Manual real-browser listening and screen-reader checks remain pending.
