# Visual features and sound

This prototype uses a single attributed NASA visualization frame, not underlying model measurements. It reports no temperature in °C and makes no claim that a black pixel is a valid zero or a scientific missing flag.

## Coordinates and image

NASA frame 23000 is 2048×1024 RGB. Full image, no margins or label masks: source x=floor((longitude+180)/360×2048); y=floor((90−latitude)/180×1024). Clamp source endpoints. Wrap horizontal sample neighborhoods at the antimeridian; omit rows outside source bounds.

The source contains no GeoTIFF georeferencing. An independent Natural Earth 1:110m land comparison supports full-image equirectangular alignment: 99.4419% agreement on 1,619,197 pixels after excluding a five-pixel coastline neighborhood and latitudes beyond 80°. Eight geographic checkpoints agree. See `alignment.json`. Approximate alignment does not establish survey-grade coordinates; do not use named geography or coastline cues yet. Coarse geometry cannot validate small islands, lakes or exact coasts.

Display is a 1536×1536 Web Mercator resampling, nearest neighbor at pixel centers. Inverse display: longitude=360u−180; latitude=atan(sinh(π(1−2v))). Latitude limited to ±85.05112878°. Source extent: ±180° longitude, ±90° latitude. No stretching or cropping is added to the square display. Pointer uses its actual bounding rectangle at event time, handling offsets and resizing. Keyboard moves in degrees; east/west wraps and latitude clamps. Cursor is stored geographically so preferences and layout do not move it.

## Sampling

The original NASA legend, `sst_ecco2_cbar.png`, is sampled at row 50, inclusive columns 15–290, excluding the black border. Palette is ordered from cooler blue to warmer red, with 276 fixed RGB entries. Palette position is 0–1; duplicated colors resolve to the first matching entry.

For each source pixel, require opaque alpha, max RGB≥24, max−min≥20, and saturation (max−min)/max≥0.3. Normalize chromatic RGB by subtracting its minimum channel and dividing by chroma (max−min) and choose the nearest source-palette entry in Euclidean chromatic RGB. Reject distance>0.2. This approximates hue/color ordering under varying trace brightness. It cannot undo scientific compositing or reconstruct exact SST.

Sampling radius defaults to 2: a 5×5 source-pixel square. Options 1 and 4 produce 3×3 and 9×9. This is a pixel neighborhood, not a fixed physical area; its geographic size varies with latitude. The mean is the unweighted arithmetic mean palette position over qualifying pixels in this neighborhood at the selected NASA frame time. It is not a geographic or temporal mean temperature. No temporal average is computed; the original model averaging interval is unverified.

Density is qualifying trace pixels divided by all available pixels in the square. A threshold can exclude dim traces; zero trace coverage means no interpretable visual sample. It does not establish physical absence, measured zero or scientific missing data. All thresholds are constant and available in `sampling.js`; normalization never follows per-frame minima/maxima.

## Audio

For mean palette position q, pitch = lowHz×(highHz/lowHz)^q (default 160–800 Hz). Palette position and density clip to [0,1]. Low and high must lie within 80–2000 Hz with low<high. Audio gain = 0.12×volume×density (default volume 0.25, peak gain≤0.03). Pitch and gain use AudioParam.setTargetAtTime with a 55 ms time constant. No stereo headphones required; sound is centered.

A valid q=0 remains audible at lowHz. No qualifying pixels yields null q, no continuous tone and two 110 Hz, 75 ms sine pulses separated by 95 ms, once on entry. Repeated motion within this state does not retrigger. Returning to valid samples cancels queued cue pulses. Surface is not classified and all valid samples use sine timbre. Land/water, coastline and boundary cues belong to milestone 4.

The legend demonstrates current configured low/mid/high pitch, 20/50/100% trace coverage, and missing visual sample. Legend replaces exploration sound; new examples cancel older ones. Resume by moving/refocusing the map. Each legend action is an explicit audio-start gesture. Volume zero silences everything without changing sample validity.

## Lifecycle and accessibility

AudioContext is created only after Start Audio or a legend action. Start handles unsupported APIs and resume errors. Pause, Silence all audio and Escape synchronously close the master gain and invalidate pending starts, cancel examples/cues, then suspend the context. Returning to the tab does not start audio automatically.

Pointer leave/cancel fades continuous sound with 40 ms time constant and cancels cue pulses. Keyboard movement/refocusing and coordinate buttons activate exploration at the preserved selected location. Moving keyboard focus to settings leaves selection and sound stable. Background tabs and pagehide silence audio and require explicit restart. Browser audio interruptions reset the UI to off.

Map is one localized role=application region to receive arrows with a screen reader; Tab exits it. Directional buttons and numeric entry offer native-control alternatives. Incidental position announcements debounce for 450 ms to avoid a queue. No application speech synthesis is included; use the accessible text/readout. Native screen-reader compatibility still requires manual verification.
