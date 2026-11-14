import { clamp } from './coordinates.js';

// Native additive synthesis keeps the fundamental tied to data, with quiet overtones.
export const PAD_PARTIALS = [0, 1, .32, .18, .10, .05];
export const MALLET_PARTIALS = [0, 1, .22, .38, .08, .12];
export function voiceFilter(fundamental) {
 return {cutoff:clamp(fundamental*3,100,10000),resonance:.55};
}
export function createSynthVoice(context, target, frequency, { profile = 'pad' } = {}) {
  const oscillator = context.createOscillator(), filter = context.createBiquadFilter();
  const partials = profile === 'knock' ? [0,1,.7,.45,.3,.2,.1] : profile === 'droplet' ? [0,1,.12,.03] : profile === 'mallet' ? MALLET_PARTIALS : PAD_PARTIALS;
  oscillator.setPeriodicWave(context.createPeriodicWave(new Float32Array(partials.length), Float32Array.from(partials)));
  oscillator.frequency.value = frequency;
  filter.type = 'lowpass'; filter.frequency.value = voiceFilter(frequency).cutoff; filter.Q.value = .55;
  oscillator.connect(filter); filter.connect(target);
  return { oscillator, filter, disconnect() { oscillator.disconnect(); filter.disconnect(); } };
}
