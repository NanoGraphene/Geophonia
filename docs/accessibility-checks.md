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

Milestones 5–6 demo and outstanding manual checks:
1. Verify stable branch points to 3a74a65, then open current main deployment. Choose the land/ocean temperature dataset, press Land test and Start Audio (or right-click the map).
2. Tab to timeline; Right moves 09:00→10:00→11:00 UTC while the coordinates remain unchanged. Left reverses. Home/End select endpoints without wrap. Map arrows must still move geographically instead of time.
3. Listen for actual timestamp/coordinates/image-derived feature; check current frame, text, sample and speech agree. Data output should duck during voice, then restore. Ocean intervals must remain 247 and 248 minutes.
4. Hold/repeat timeline keys: only newest completed selection should narrate; no stale speech queue. Turn Speak time changes off mid-sentence: immediate cancellation, with data sound continuing. Re-enable for the next selection. Read current data should work even while auto speech is off.
5. Pause data audio while leaving speech available; then Silence/Escape mid-speech. Both app audio paths must stop; timeline changes stay text-only until explicit Start/read. Inactive tab and fullscreen close must behave similarly.
6. Delay/fail individual frame requests: no old sampled value under a new timestamp, stale responses cannot commit, and Retry works. Disable speech synthesis: text and native control values remain usable without duplicate app live-region narration.

74 automated checks pass, including request/cache races, irregular timestamps/endpoints, fixed location, speech toggle/cancellation/debounce, fallback, valid zero and duck/mute ordering. Actual voice playback, fullscreen layout, keyboard with screen readers and low-vision zoom remain unverified. Milestone 7 cannot be considered complete until these manual checks and participant feedback are performed.
