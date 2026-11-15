# Verification and demo

Automated: `npm test`, `npm run check`, `npm run build`.

The managed environment lacks the required `cua_repl.js` browser tool. Per Sites managed-preview guidance, no preview server or alternate browser path was started. Automated checks establish pure mapping behavior, mocked Web Audio scheduling, source assets and markup references. They do not establish audible quality, actual autoplay behavior, visual layout or screen-reader usability.

Manual checks still required:
- Tab from Start/controls into and out of map; arrows move only while map has focus; Home returns to 30° N, 45° W.
- Try the native directional controls and numeric form with NVDA/Firefox and VoiceOver/Safari; confirm application-region instructions and no Tab trap.
- At 200%/400% zoom and 320px-wide viewport, inspect readable controls, wrapping, visible focus and map resizing.
- Start Audio; traverse colored traces and gray land. Confirm comfortable default volume, higher pitch with warmer source colors, no hard clicks and two missing-sample notes.
- Set volume zero, change pitch range, play each legend, then Silence/Escape during a legend and immediately after Start. All sound should stop. Return from an inactive tab: sound must stay off.
- Verify once with mono speakers and headphones. Invite blind/low-vision participants to assess instructions and cue recognizability.
- Disable image/JSON requests, then Retry; loading failure must leave no stale sample or audio. Unsupported Web Audio should retain text navigation.

Demo sequence: start at 30° N 45° W; Start Audio; change spatial step to 5° and explore. Play pitch, coverage and no-sample examples separately. Go to 23° N 15° E (gray Sahara interior; no visual sample). Return to start. Silence all audio. Inspect source/projection explanation.

Milestone 4 automated checks also cover pinned mask integrity, lake holes and islands, cross-country travel, near-coast hysteresis, rapid Madagascar entry/exit, antimeridian path choice, all edges/corners, resize/exit clipping, mute/cancellation and separate reference-guide gain. 44 tests pass. No timeline or TTS is included yet.

Current sound revision supersedes the earlier sine/triangle and shoreline-beep demos. 47 automated checks cover the new harmonic wave, filter smoothing, constant oscillator across surfaces, silent crossing events, zero-contrast equality, softened cue envelopes, and all existing coordinate/geography regressions.

Manual checks still needed:
- Play “Hear the continuous filter morph”: one held pitch changes water → land → water by filter only. Test 0%, 65% and 100% contrast and find a comfortable setting.
- Go to 10° N, 20° W and move east over west Africa. Surface should become brighter without a notification, including on the fixed 140 Hz guide when no visual sample exists.
- Traverse gaps in the ocean image: text reports no sample, data tone stops, optional reference persists, and no repeated beeps play.
- Audition all softened boundary mallets in mono. Confirm the rhythms remain identifiable with longer overlapping release tails.
- Escape/Silence, volume zero during queued sounds, inactive tabs, failed geometry loading, keyboard navigation, zoom and screen readers still need browser verification.

These listening/browser checks have not been performed in the managed environment.

Expanded-map/land-source manual checks: choose the temperature dataset, press Land test and Start Audio, then compare Water test. Both must show a numeric visual feature and data pitch (not “No data tone”). Expand the map, resize landscape/portrait, move by mouse/arrows, and return: selected geographic location stays fixed during layout changes. Verify focus containment, Escape silence/close, optional native fullscreen failure fallback and all expanded controls. Rapidly switch datasets with delayed/failed requests: no stale frame or sample may appear. All remain pending browser checks. Pure conversion, request-gate and real-source patch regressions are automated (55 tests).

Fullscreen correction: 59 automated checks now include embedded permission denial, browser request rejection, actual fullscreen-state confirmation and frozen full-resolution PNG provenance. Manually verify Expand in standalone and embedded contexts, visible denial/fallback link, map dimensions, dataset/audio controls, Escape restoration and selection stability. These browser/layout checks remain pending; the original reported visual failure has not been reproduced in this environment.

Full-world fit correction: verify all map edges, polar limits and corners remain visible in fullscreen at wide and portrait sizes. Margins should not respond to pointer sampling. Automated geometry tests check full extent and square containment for landscape, portrait, compact and collapsed stages (60 total tests). Browser visual verification remains pending.

Current fullscreen behavior supersedes square fitting: the full map stretches to the available width AND height, without margins or crop. Check wide/portrait views, all corners, and coordinate/sample alignment. The geometry regression now asserts full stage usage and pointer correctness on stretched rectangles (60 total tests).

Current sound revision supersedes constant-filter demos: audition the 45 ms entering-land knock and 85 ms entering-water droplet under “Brief shoreline notifications.” Move east from 10° N, 20° W across west Africa and back; verify direction recognition, no stationary jitter, and no change in the underlying data timbre. Coordinate jumps should not trigger a crossing. Missing data should have no reference drone. Test crossing toggle, volume zero and Escape during a rapid pair. Automated duration/signature and neutral-voice checks pass; these listening/browser checks remain pending.

Right-click audio start: verify right-click selects the pointer location and starts audio, repeated right-click does not pause it, and right-click after Pause or a legend resumes exploration. Check both standard and expanded layouts, loading/failed datasets, browser context menus outside the map, and Escape during an in-flight start. Existing Start Audio remains the keyboard alternative. These manual browser checks remain pending.

Natural narration revision: 67 automated checks pass. Real Kitten Nano INT8 inference produces non-silent 24 kHz audio using the vendored browser SDK in Node/WASM. This does not verify browser integration or subjective voice quality. Manually audition the supplied preview, load the model, try each Read action in standard/expanded views, test download failure/retry, explicit browser fallback, voice/speed changes, volume zero, Escape, moving/dataset changes while generating, backgrounding, and restoring sonification volume. Check first-use latency and memory on mobile and keyboard/screen-reader status announcements. No automatic browser verification was available.

## Current revision 0.5.0: speech shortcuts and timeline

This supersedes the Kitten/manual-load narration checks above. 82 automated checks pass. No browser, real speech listening or screen-reader checks were available.

Manual checks: hover a country, sea and ocean and press 1; confirm the spoken name matches the visual cursor and place readout. Press 2 over a valid land/ocean temperature patch and a missing ocean trace: hear approximate degrees Celsius or explicit no value, never a fabricated zero. Press 3 after changing time: hear the selected UTC date/time. Ensure numeric typing in coordinates and changing volume/voice controls do not trigger global shortcuts. Disable Spoken shortcuts and verify 1/2/3 no longer trigger; buttons still show text. Test asynchronously arriving voices, enhanced/natural voice selection, a manual voice choice, speech unavailable/blocked, new speech replacing old, Escape, tab hiding, volume zero and restoring data audio gain.

Drag both standard/expanded sliders; use Left/Right and Home/End on sliders, and Left/Right over the map. Verify actual imagery, sample and date change together at fixed geography. Up/Down moves spatially, Shift+Left/Right moves west/east, and directional buttons still move spatially. Hold time arrows, change datasets during slow loads, inject a failed frame and Retry; old dates/values must never reappear. Expanded layout must retain full map extent and synchronized controls in landscape/portrait.

## Current revision 0.6.0: profile-driven 2D datasets

102 automated checks pass; real browser/speech/screen-reader checks remain unavailable. In addition to 0.5.0 checks, select every catalog profile in standard/expanded views and verify source name, variable, unit, legend, amplitude source, sampling location and selected period. One-frame sliders must disable; annual night-light labels must not invent January 1 timestamps; lightning must say scientific date unverified. Test all aerosol categories without interpreting category colors as an ordered concentration.

Import the synthetic example CSV and a real regular lat/lon CSV, confirm automatic columns/units and fixed all-frame range, inspect valid zero and missing cells, and use Go to dataset center for regional coverage. Test malformed/irregular grids, duplicates, missing marker, unit not supplied and rapid file replacement. Imported data must remain local to the tab. Verify column fields and mapping number inputs do not trigger speech/time shortcuts. Adjust pitch endpoints/value range/linear-log-sqrt curves/amplitude channels and compare sound, displayed units and spoken value. Overrides must stay stable while stepping time; invalid settings must provide visible feedback. Confirm Escape/mute and narration ducking still work after import/source/category changes. Check responsive controls and full-map stretch without cropping.

## Current 0.6.1: Firefox/Linux built-in voice

The default engine no longer requires system Speech Synthesis or Speech Dispatcher. In Firefox/Linux, click Test voice beside the map, then hover Germany/Atlantic and use1, read a value with2 and the current frame/period with3. Verify the native voice list may be empty without blocking the built-in voice, map volume0 leaves Speech volume100 audible, and Speech volume0 stops both engines. Test checkbox focus, retained selector focus while pointing at the map, true text fields, shifted numerals, standard/expanded mode, blocked embedded autoplay, standalone retry and muted/hidden-tab cancellation. Fast repeated keys during fetch/decode must never play an older reading. Check names, decimal/negative values, annual averages and unverified lightning dates, plus spelled custom units.

Automated engine/plan tests and full recorded-asset coverage checks supplement prior regressions; real browser speaker output, voice quality and screen-reader interactions remain unverified because browser-control tooling is unavailable.

## Current0.7.0: Phonon streaming

The sole TTS runtime is Phonon31M, loaded automatically at page startup with visible progress. Loading initializes the model without synthesizing speech or opening an audio device. Keys1/2/3 and read buttons keep their existing meaning and protect typing fields. New readings stop scheduled PCM immediately and replace outdated worker generation without reloading the model. Speech gain, map ducking, enable/mute, speed, fullscreen player relocation, Escape/global silence and page-hide cancellation remain supported.

Tests cover early frame playback before complete WAV, no duplicated replay, cancellation, stale results, cold-load requests, volume, blocked activation/manual fallback, initialization retry and actual app DOM/key wiring. Separate real production-worker checks verify new numeric/date/place sentences, stream ordering and model reuse. These do not verify speaker output, Firefox or screen-reader behavior. Manually test startup download/cache, rapid1/2/3 replacement, interruption, expanded map, muted speech, native replay, map ducking and actual latency on target hardware.

## GUI-Optimization: self-voicing tabbed workspace

Automated checks cover manual tab activation, roving focus, hidden panels, collapse/restore, unchanged map/data state, focus labels, selected/checked/expanded values, debouncing, typing/password protection, narration ownership, data-reading priority and Escape cancellation. Full-app DOM checks exercise the tab/listener/Phonon integration. Live layout and actual speaker verification are still required. Keyboard-only user acceptance should include: start with Tab; explore all four tabs; change a native select/range without altering time accidentally; use1/2/3 in the map; submit invalid coordinates/pitch; open/close advanced settings; try fullscreen Return to controls; disable/re-enable interface narration; press Escape during speech, loading and a panel change.
