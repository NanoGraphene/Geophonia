# Visual features and sound

The current prototype uses three attributed NASA visualization frames per dataset, not underlying model measurements. It reports a whole-degree approximate temperature in °C estimated from source palette position, and retains the normalized color feature for audio. A black/unmatched pixel is not a scientific zero or verified missing flag.

## Coordinates and image

NASA frame 23000 is 2048×1024 RGB. Full image, no margins or label masks: source x=floor((longitude+180)/360×2048); y=floor((90−latitude)/180×1024). Clamp source endpoints. Wrap horizontal sample neighborhoods at the antimeridian; omit rows outside source bounds.

The source contains no GeoTIFF georeferencing. An independent Natural Earth 1:110m land comparison supports full-image equirectangular alignment: 99.4419% agreement on 1,619,197 pixels after excluding a five-pixel coastline neighborhood and latitudes beyond 80°. Eight geographic checkpoints agree. See `alignment.json`. Approximate alignment does not establish survey-grade coordinates. Milestone 4 adds a separately validated 1:50m land/lake mask for approximate surface cues (see below). Geographic names remain withheld; small islands and exact shorelines remain uncertain.

Display is a 1536×1536 Web Mercator resampling, nearest neighbor at pixel centers. Inverse display: longitude=360u−180; latitude=atan(sinh(π(1−2v))). Latitude limited to ±85.05112878°. Source extent: ±180° longitude, ±90° latitude. The standard display is square; expanded view stretches it independently to the stage width and height without cropping. Pointer uses its actual bounding rectangle at event time, handling offsets and resizing. Keyboard moves in degrees; east/west wraps and latitude clamps. Cursor is stored geographically so preferences and layout do not move it.

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

Automated waveform/envelope/cancellation and geographic path tests pass. Sound recognizability, loudness comfort, real browser behavior and screen-reader usability remain unverified without manual listening/browser access. Three-frame timeline selection and instant browser speech are now included; see the 0.5.0 revision below.

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

Boundary patterns use the harmonic mallet envelopes described above. A preference toggles boundary cues; shorelines play brief knock/droplet crossing cues; no continuous surface filter remains. Silence, Escape and tab inactivity cancel every cue and both continuous voice groups.

## Dataset and expanded viewport revision

Ocean chromatic matching remains unchanged. SVS 5147 uses literal RGB matching because its temperature palette is not monotonic in hue; see `temperature-source.md`. Location and preferences survive source changes; frame, palette, metadata and timestamp commit together behind a request-generation guard. A failed new load cannot allow an older response to commit.

Expanded view uses a native modal dialog and optionally the browser Fullscreen API. The existing map element is moved, not cloned. Native dialog focus containment leaves background controls inert; expanded audio controls proxy the same engine. On close, focus returns to Expand map. The full map is always visible and now stretches independently to the stage width and height at the user's request. object-fit:fill and an unconstrained map aspect ratio remove square letterboxing without cropping. The geographic viewport remains [0,1] on both Mercator axes. Pointer/cursor conversion normalizes against the actual stretched rectangle, so the displayed location, sampling and boundary cues stay aligned. Resize/expand/restore preserve latitude/longitude. Escape retains emergency silence behavior; fullscreen exit also pauses audio.

Fullscreen correction supersedes the earlier two-step fullscreen description: Expand requests browser fullscreen within its click gesture when permitted. A fixed, inset modal with an independently sized flex stage and absolutely positioned map remains available when native requests fail. Capability/failure messages are visible; the standalone-app link offers a different browser context. Native fullscreen exit restores the normal view, pauses audio and returns focus. Success is never inferred merely from a resolved request promise; fullscreenElement must identify the dialog.

## 0.5.0 speech shortcuts, place names and timeline

1 reads a local country/marine/lake polygon name, 2 the estimated whole-degree temperature and unit, and 3 the selected frame timestamp in UTC. Speech uses the browser API immediately, preferring available natural/enhanced English voices and allowing manual selection. Spoken shortcuts can be disabled. New readings supersede old callbacks; Escape, inactive tabs and Silence cancel speech. Pointer movement preserves an explicitly requested reading of the point selected at keypress; time/dataset changes cancel it.

Celsius conversion uses `manifest.valueScale`: 0–32 °C for the ocean source and −40–40 °C for land/ocean temperature. This linearly maps normalized source palette position, rounds to whole degrees and always calls the spoken value an image estimate. It does not recover authoritative source-grid temperature; non-monotonic palettes and terrain shading remain ambiguous.

Natural Earth point-in-polygon lookup is separate from the surface mask. It retains holes and cut-at-antimeridian polygons, prioritizes lakes over country fill and smaller marine regions over broad oceans, and reports unknown names without guessing. Exact source revision and integrity hash: `public/geography/place-names-manifest.json`.

Left/Right changes frames from the currently requested slider target, including while another frame loads. Shift+Left/Right on the map moves spatially. Both sliders track the same target; both sampling/display images must decode before the latest request can commit frame, date and value. Samples clear and sound fades during a load. Successful commits sample the current shared location and resume enabled sonification. Old responses and failures cannot overwrite a newer request. A failed current frame remains unavailable and exposes Retry. Three available dates per dataset are discrete, with no interpolation.
