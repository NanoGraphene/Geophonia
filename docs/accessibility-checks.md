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

No timeline or TTS in this version. Land/water timbres, coastline/edge cues await milestone 4.
