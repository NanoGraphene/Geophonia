import { clamp } from './coordinates.js';
import { SOUND_PROFILES } from './sound-profiles.js';

// Native additive synthesis keeps the fundamental tied to data, with quiet overtones.
export const PAD_PARTIALS = [0, 1, .32, .18, .10, .05];
export const MALLET_PARTIALS = [0, 1, .22, .38, .08, .12];
export const PLUCK_PARTIALS = [0, 1, .55, .25, .12, .04];
export const BRIGHT_PLUCK_PARTIALS = [0, 1, .2, .08, .03];
export const DRUM_PARTIALS = [0, 1, .8, .45, .2, .08];
export const PAD_VOICES = [
  { ratio: 1, detune: -4, gain: .42 },
  { ratio: 1, detune: 4, gain: .28 },
  { ratio: 1.5, detune: -2, gain: .18 },
  { ratio: 2, detune: 3, gain: .12 }
];
const DATA_VOICES=[{ratio:1,detune:0,gain:.64},{ratio:2,detune:0,gain:.18},{ratio:3,detune:0,gain:.1},{ratio:1,detune:4,gain:.08}];
export function voiceFilter(fundamental) {
 return {cutoff:clamp(fundamental*4,100,18000),resonance:.55};
}
export function createSynthVoice(context, target, frequency, { profile = 'pad' } = {}) {
  const filter = context.createBiquadFilter();
  const nyquist=(context.sampleRate??48000)/2;
  const panner = typeof context.createPanner === 'function' ? context.createPanner() : null;
  let currentProfile=profile;
  const partials = SOUND_PROFILES[profile]?.partials??(profile === 'pluck' ? PLUCK_PARTIALS : profile === 'bright-pluck' ? BRIGHT_PLUCK_PARTIALS : profile === 'drum' ? DRUM_PARTIALS : profile === 'knock' ? [0,1,.7,.45,.3,.2,.1] : profile === 'droplet' ? [0,1,.12,.03] : profile === 'mallet' ? MALLET_PARTIALS : PAD_PARTIALS);
  const voiceSpecs = SOUND_PROFILES[profile]?DATA_VOICES:profile === 'pad' ? PAD_VOICES : [{ ratio: 1, detune: 0, gain: 1 }];
  const wave=values=>context.createPeriodicWave(new Float32Array(values.length),Float32Array.from(values));
  const initialWave=wave(partials);
  const oscillators = voiceSpecs.map(spec => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.setPeriodicWave(initialWave);
    const hz=frequency*spec.ratio;
    oscillator.frequency.value = Math.min(hz,nyquist*.98);
    oscillator.detune.value = spec.detune;
    gain.gain.value = spec.gain*clamp((nyquist*.95-hz)/(nyquist*.2),0,1);
    oscillator.connect(gain); gain.connect(filter);
    return { oscillator, gain };
  });
  filter.type = 'lowpass'; filter.frequency.value = Math.min(voiceFilter(frequency).cutoff,nyquist*.9); filter.Q.value = .55;
  if (panner) {
    panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
    panner.refDistance = 1; panner.rolloffFactor = .3; panner.maxDistance = 10000;
    panner.positionX.value = 0; panner.positionY.value = 0; panner.positionZ.value = -1.5;
    filter.connect(panner); panner.connect(target);
  } else filter.connect(target);
  return {
    oscillator: oscillators[0].oscillator,
    oscillators: oscillators.map(entry => entry.oscillator),
    filter, panner,
    get profile(){return currentProfile;},
    setProfile(next){
      if(next===currentProfile||!SOUND_PROFILES[next]||!SOUND_PROFILES[currentProfile])return;
      const nextWave=wave(SOUND_PROFILES[next].partials);
      oscillators.forEach(entry=>entry.oscillator.setPeriodicWave(nextWave));currentProfile=next;
    },
    setFrequency(frequency,apply){
      oscillators.forEach((entry,index)=>{
        const spec=voiceSpecs[index],hz=frequency*spec.ratio;
        // Taper voices near Nyquist instead of folding inaudible harmonics down.
        apply(entry.oscillator.frequency,Math.min(hz,nyquist*.98));
        apply(entry.gain.gain,spec.gain*clamp((nyquist*.95-hz)/(nyquist*.2),0,1));
      });
    },
    start(time) { oscillators.forEach(entry => entry.oscillator.start(time)); },
    stop(time) { oscillators.forEach(entry => {try{entry.oscillator.stop(time);}catch{/* Already stopped. */}}); },
    disconnect() { oscillators.forEach(entry => { entry.oscillator.disconnect(); entry.gain.disconnect(); }); filter.disconnect(); if (panner) panner.disconnect(); }
  };
}
