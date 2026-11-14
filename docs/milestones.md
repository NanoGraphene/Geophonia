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

## Next, not implemented
4: land/water geometry, timbres, coast and edge cues.
5: timeline and loading consistency across frames.
6: time-change speech, cancellation and ducking.
7: complete accessibility/manual listening review and demonstration.
8: optional enhancements.
