# Milestone log

## 1 — Source assessment (reviewed)
SVS 5533 rejected for changing pollutant strips and absent verified per-frame dates/legend. User approved proceeding with SVS 3912 for milestones 2 and 3.

## 2 — Map shell (implemented)
- Vanilla JavaScript ES modules, Vite, one local attributed frame; no backend.
- Empirically aligned full-image equirectangular source, derived Web Mercator display.
- Pointer, map arrow keys, adjustable degree step, Home/reset, numeric coordinate form, directional buttons.
- Geographic and source-pixel readout; explicit fixed timestamp; focus and live status.
- Six automated tests passed, production build passed. Tests cover projection round trips, source endpoints, resizing/offsets, antimeridian, latitude clamp, shared state, and recorded alignment thresholds.
- Browser, manual keyboard and screen-reader checks unverified: managed browser tool unavailable.

## 3 — Audio (implemented)
- Source-colorbar matching, configurable source neighborhood, separate mean palette position and trace-coverage density.
- Web Audio continuous sine tone; exponential pitch, linear gain, smoothing, conservative defaults.
- Explicit Start/Pause, immediate all-audio silence and Escape, volume/pitch settings, no-sample cue and audio legend.
- Background/interrupted audio stays off until explicit restart; stale Start completions cannot undo Silence.
- 21 automated tests passed, including earlier regression checks and real NASA image patches. Source/markup checks and production build passed.
- Browser, listening, screen-reader and real autoplay checks remain unverified; see accessibility-checks.md.
- Both milestones authorized together; stopped before milestone 4 for user feedback.

## 4 — Geographic sound and boundary cues (implemented)
- Natural Earth 1:50m land/lake mask, public-domain attribution, pinned source hashes, polygon holes/lake islands, independent fetch integrity checks and retry.
- 12 surface checkpoints and 4 coastline transects passed. Approximate non-coastal mask agreement with NASA rendering: 99.7268%; exact shorelines remain uncertain.
- Water sine / land triangle timbres with smoothed crossfades and nominal RMS compensation. Optional separate 140 Hz surface guide when data is unsampled, never a fabricated data tone.
- Shoreline spatial hysteresis and raster-cell path inspection, including a rapid Madagascar transect. Coordinate jumps/reset do not manufacture crossings.
- Mono four-edge/four-corner patterns, corner priority, 12/18 px entry/release zones, clipped pointer exit, stationary suppression and bounded cue replacement.
- Accessible toggles, surface/near-shore readout and reference legend examples for every cue.
- 44 automated tests passed (including all prior regression tests); source/markup checks and production build passed.
- Browser, listening, actual autoplay and screen-reader usability remain unverified: required managed browser tool unavailable. Nominal waveform RMS is not a perceived-loudness certification.
- Stop before milestone 5 for user feedback.

## Next, not implemented
5: timeline and loading consistency across frames.
6: time-change speech, cancellation and ducking.
7: complete accessibility/manual listening review and demonstration.
8: optional enhancements.

## Sound-design revision — user feedback
- Replaced simple waveform timbres with a native additive harmonic wavetable synth and continuous low-pass surface modifier. Default 65% surface contrast is adjustable; zero yields identical filters.
- Removed land/water notification sounds and their UI. Removed automatic gap beeps. Optional fixed 140 Hz surface guide stays distinct from missing data.
- Soft harmonic mallet edge/corner cues, longer envelopes and quieter gain. Added a held-note filter-morph demonstration.
- 47 tests, source checks and production build passed. Manual listening/browser/screen-reader review remains unverified; subjective sound comfort needs user feedback.
- This revises milestone 4; timeline work is still pending.

## Expanded map and land-capable dataset revision
- Window-filling modal map, optional native browser fullscreen, visible dataset/audio/silence controls, preserved selection and projection-aware viewport conversion.
- Added frozen NASA SVS 5147 GEOS-FP temperature snapshot covering land and water, with exact timestamp, attribution, independent palette, overlay masks and terrain-shading limits.
- Added Sahara/Atlantic test buttons and a dataset selector retaining the ocean resource. Real temperature patches verify land and water samples.
- Versioned loading clears previous samples, prevents stale commits and supports failed-source retry. This does not implement temporal navigation yet.
- 55 automated tests, source checks and production build passed. Browser fullscreen/focus/layout, listening and screen-reader verification remain unverified because the managed browser tool is unavailable.
