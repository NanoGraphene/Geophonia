import { clamp } from './coordinates.js';

// Native additive synthesis keeps the fundamental tied to data, with quiet overtones.
export const PAD_PARTIALS = [0, 1, .32, .18, .10, .05];
export const MALLET_PARTIALS = [0, 1, .22, .38, .08, .12];
export function voiceFilter(fundamental) {
 return {cutoff:clamp(fundamental*3,100,10000),resonance:.55};
}
export function createSynthVoice(context, target, frequency, { profile = 'pad', partials: customPartials = null, voices = null } = {}) {
  const filter = context.createBiquadFilter();
  const partials = customPartials ?? (profile === 'knock' ? [0,1,.7,.45,.3,.2,.1] : profile === 'droplet' ? [0,1,.12,.03] : profile === 'mallet' ? MALLET_PARTIALS : PAD_PARTIALS);
  const voiceSpecs = voices ?? [{ ratio: 1, detune: 0, gain: 1 }];
  const oscillators = voiceSpecs.map(spec => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.setPeriodicWave(context.createPeriodicWave(new Float32Array(partials.length), Float32Array.from(partials)));
    oscillator.frequency.value = frequency * spec.ratio;
    oscillator.detune.value = spec.detune;
    gain.gain.value = spec.gain;
    oscillator.connect(gain); gain.connect(filter);
    return { oscillator, gain };
  });
  filter.type = 'lowpass'; filter.frequency.value = voiceFilter(frequency).cutoff; filter.Q.value = .55;
  filter.connect(target);
  return {
    oscillator: oscillators[0].oscillator,
    oscillators: oscillators.map(entry => entry.oscillator),
    filter,
    start(time) { oscillators.forEach(entry => entry.oscillator.start(time)); },
    disconnect() {
      oscillators.forEach(entry => { entry.oscillator.disconnect(); entry.gain.disconnect(); });
      filter.disconnect();
    }
  };
}
