export const START_LOCATION = Object.freeze({ lon: -45, lat: 30 });
export function initialState() {
  return { dataset: 'svs-3912', variable: 'temperature-color', location: { ...START_LOCATION },
    timeIndex: 0, timestamp: '2007-03-25T12:00:00Z', sample: null, validity: 'loading',
    surface: 'unknown', nearCoast: false, geographyStatus: 'loading', lastCue: 'No navigation cue yet', spatialStep: 1, radius: 2,
    audio: { enabled: false, volume: 0.25, toneHz: 220, minHz: 160, maxHz: 800, coastCues: true, boundaryCues: true } };
}
export function createStore(initial = initialState()) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    update(patch) { state = { ...state, ...patch }; for (const f of listeners) f(state); return state; },
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); }
  };
}
