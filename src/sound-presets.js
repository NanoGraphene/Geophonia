export const SOUND_PRESETS = Object.freeze({
  ambientHeat: Object.freeze({
    profile: 'pad',
    rootHz: 110,
    gain: 0.12,
    filter: Object.freeze({
      type: 'lowpass',
      cutoffMin: 220,
      cutoffMax: 2400,
      resonanceMin: 0.4,
      resonanceMax: 7
    }),
    voices: Object.freeze([
      Object.freeze({ ratio: 1, detune: -3, gain: 0.52 }),
      Object.freeze({ ratio: 1.25, detune: 2, gain: 0.3 }),
      Object.freeze({ ratio: 1.5, detune: -1, gain: 0.18 })
    ])
  }),
  aerosolDust: Object.freeze({
    profile: 'pad',
    rootHz: 82,
    gain: 0.08,
    partials: [0, 1, .42, .20, .08, .03],
    filter: Object.freeze({ type: 'lowpass', cutoffMin: 180, cutoffMax: 1300, resonanceMin: .3, resonanceMax: 3.2 })
  }),
  aerosolSmoke: Object.freeze({
    profile: 'pad',
    rootHz: 98,
    gain: 0.07,
    partials: [0, 1, .28, .16, .11, .04],
    filter: Object.freeze({ type: 'lowpass', cutoffMin: 220, cutoffMax: 1700, resonanceMin: .35, resonanceMax: 4.2 })
  }),
  aerosolSeaSalt: Object.freeze({
    profile: 'pad',
    rootHz: 123,
    gain: 0.065,
    partials: [0, 1, .20, .24, .10, .06],
    filter: Object.freeze({ type: 'lowpass', cutoffMin: 260, cutoffMax: 2100, resonanceMin: .4, resonanceMax: 5 })
  }),
  aerosolSulphate: Object.freeze({
    profile: 'pad',
    rootHz: 147,
    gain: 0.055,
    partials: [0, 1, .16, .10, .18, .07],
    filter: Object.freeze({ type: 'lowpass', cutoffMin: 300, cutoffMax: 2500, resonanceMin: .45, resonanceMax: 5.8 })
  })
});

export const DEFAULT_SOUND_PRESET = 'ambientHeat';