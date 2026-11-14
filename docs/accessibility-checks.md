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

Additional manual milestone 4 demo/checks:
- Play “Water timbre” and “Land timbre” at the same reference pitch; compare perceived loudness with mono speakers and headphones. Check the separate 140 Hz guide, then disable its toggle and confirm missing samples retain zero data tone.
- Go to 10° N, 20° W, choose 1° step, focus the map and move east across the west African shoreline. Crossing should rise into land; return west to hear falling notes. Near-shore jitter should not repeatedly beep.
- Go to 20° S, 40° E and move east over Madagascar. With coarse moves the path checker should still detect entry and exit; small unrepresented islands/channels can be omitted.
- Play each of the eight map-boundary reference buttons. Confirm directions remain identifiable without stereo and corner patterns combine vertical then horizontal.
- At 0° latitude, 179° longitude, focus map and move east: right edge then antimeridian/left edge. At latitude 85° and longitude 179°, an up move should produce the top-right corner pattern once. Holding at the limit must not repeat it.
- Move the pointer rapidly out of an edge/corner. The exit cue may finish while the data/reference tones fade. Re-enter to re-arm. Press Escape mid-cue: every voice must stop immediately.
- Toggle shoreline/boundary cues off during a cue and change volume to zero during queued notes. No stale cue should remain.
- Block the geography binary or corrupt its bytes. Surface must become unavailable with a Retry surface geometry button; NASA data sound and edge cues remain usable. Do not infer land/water from NASA colors.

These manual checks have not been executed in this environment. Obtain blind/low-vision participant feedback before treating cue recognizability and screen-reader behavior as verified.
