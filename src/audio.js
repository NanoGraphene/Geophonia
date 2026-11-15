import { mapAudio, mapBoundaryPosition, mapSpatialPosition } from './audio-mapping.js';
import { boundaryPattern, patternDuration } from './navigation-cues.js';
import { createSynthVoice, voiceFilter } from './synth-voice.js';
export class AudioEngine {
  constructor(factory = () => {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) throw new Error('Web Audio is unavailable in this browser.');
    return new AudioContext();
  }) {
    this.factory = factory; this.context = null; this.enabled = false;
    this.epoch = 0; this.pendingTones = new Set(); this.lastValidity = null; this.lastVolume = null;
    this.onInterrupted = () => {}; this.narrating = false;
  }
  setup() {
    if (this.context) return;
    this.context = this.factory();
    this.context.listener?.setOrientation?.(0, 0, -1, 0, 1, 0);
    this.master = this.context.createGain(); this.master.gain.value = 0;
    this.narrationGain = this.context.createGain();
    this.narrationGain.gain.value = this.narrating ? .2 : 1;
    this.master.connect(this.narrationGain); this.narrationGain.connect(this.context.destination);
    this.level = this.context.createGain(); this.level.gain.value = 0; this.level.connect(this.master);
    this.dataVoice = createSynthVoice(this.context, this.level, 1000,{profile:'harmonic'});
    this.dataVoice.start();
    this.oscillator = this.dataVoice.oscillator;
    this.context.onstatechange = () => {
      if (this.enabled && this.context.state !== 'running') { this.stop(); this.onInterrupted(); }
    };
  }
  smooth(parameter, value, timeConstant = .055) {
    if (!parameter || !Number.isFinite(value)) return;
    const time = this.context.currentTime;
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(time);
    else parameter.cancelScheduledValues(time);
    parameter.setTargetAtTime(value, time, timeConstant);
  }
  async start() {
    const epoch = ++this.epoch;
    this.setup(); await this.context.resume();
    if (epoch !== this.epoch) { if (!this.enabled) await this.context.suspend(); return false; }
    this.enabled = true;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setValueAtTime(1, this.context.currentTime);
    this.lastValidity = null; return true;
  }
  cancelTones(group = null) {
    if (!this.context) return;
    for (const entry of [...this.pendingTones]) {
      if (group && entry.group !== group) continue;
      entry.gain.gain.cancelScheduledValues(this.context.currentTime);
      entry.gain.gain.setValueAtTime(0, this.context.currentTime);
      entry.voice.stop();
      entry.voice.disconnect(); entry.gain.disconnect(); this.pendingTones.delete(entry);
    }
  }
  cancelLegend() { this.cancelTones('legend'); }
  setNarrationActive(active) {
    this.narrating = active;
    if (this.context) this.smooth(this.narrationGain.gain, active ? .2 : 1, .06);
  }
  stop() {
    this.epoch++; this.enabled = false; this.lastValidity = null;
    if (!this.context) return;
    for (const node of [this.master, this.level]) {
      node.gain.cancelScheduledValues(this.context.currentTime);
      node.gain.setValueAtTime(0, this.context.currentTime);
    }
    this.cancelTones(); this.context.suspend().catch(() => {});
  }
  fade() {
    if (!this.context) return;
    this.smooth(this.level.gain, 0, .04);
    this.lastValidity = null;
  }
  update(sample, preferences, active, surface = 'unknown', position = null) {
    if (this.context && this.lastVolume !== preferences.volume) {
      this.cancelTones(); this.lastVolume = preferences.volume;
    }
    if (!this.enabled || !active || !sample) { this.fade(); return; }
    const spatial = mapSpatialPosition(position);
    if (spatial && this.dataVoice.panner) {
      this.smooth(this.dataVoice.panner.positionX, spatial.x, .02);
      this.smooth(this.dataVoice.panner.positionY, spatial.y, .02);
      this.smooth(this.dataVoice.panner.positionZ, spatial.z, .02);
    }
    const { frequency, gain } = mapAudio(sample, preferences);
    // Timbre identifies the variable, never land/water or the sampled value.
    this.dataVoice.setProfile(preferences.voiceProfile??'harmonic');
    if (frequency !== null) {
      if (this.lastValidity === 'no-visual-sample') this.cancelTones('missing');
      this.dataVoice.setFrequency(frequency,(parameter,value)=>this.smooth(parameter,value,.025));
      this.smooth(this.dataVoice.filter.frequency,Math.min(voiceFilter(frequency).cutoff,(this.context.sampleRate??48000)*.45));
    }
    this.smooth(this.level.gain, gain);
    this.lastValidity = sample.validity;
  }
  tone(frequency, delay, duration, gain, { profile = 'mallet', group = 'legend', short = false, endHz = null, position = null } = {}) {
    if (!this.enabled) return;
    const envelope = this.context.createGain();
    const voice = createSynthVoice(this.context, envelope, frequency, { profile });
    const { oscillator } = voice;
    voice.filter.frequency.value = Math.min(voiceFilter(frequency).cutoff,(this.context.sampleRate??48000)*.45);
    envelope.connect(this.master);
    duration = Math.max(duration, short ? .03 : .16);
    const start = this.context.currentTime + delay;
    if (position && voice.panner) {
      voice.panner.positionX.setValueAtTime(position.x, start);
      voice.panner.positionY.setValueAtTime(position.y, start);
      voice.panner.positionZ.setValueAtTime(position.z, start);
    }
    const attack = profile === 'pluck' ? .002 : profile === 'drum' ? .001 : short ? .003 : Math.min(.05, duration / 3);
    const hold = profile === 'pluck' ? Math.min(duration * .08, .008) : profile === 'drum' ? Math.min(duration * .12, .012) : short ? .006 : Math.max(.02, duration * .4);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + attack);
    envelope.gain.setValueAtTime(gain * (profile === 'pluck' ? .72 : profile === 'drum' ? .58 : 1), start + attack + hold);
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    const entry = { oscillator, voice, gain: envelope, group };
    this.pendingTones.add(entry);
    oscillator.onended = () => { this.pendingTones.delete(entry); voice.disconnect(); envelope.disconnect(); };
    const pitchEnd = endHz ?? (profile === 'drum' ? frequency * .62 : null);
    if(pitchEnd!==null){oscillator.frequency.setValueAtTime(frequency,start);oscillator.frequency.linearRampToValueAtTime(pitchEnd,start+duration*.75);}
    voice.start(start); voice.stop(start + duration + .01);
    return entry;
  }
  playPattern(pattern, volume, group, offset = 0, profile = 'mallet', position = null) {
    for (const note of pattern) this.tone(note.hz, note.delay + offset, note.duration, .16 * volume, { group, profile, position });
  }
  missingCue(volume, group = 'missing') {
    // Explicit legend only: a low, softly filtered swell, never repeated over gaps.
    this.tone(110, 0, .65, .06 * volume, { group });
  }
  crossingCue(surface, volume, group = 'coast', delay = 0) {
    if(surface==='land')return this.tone(330,delay,.045,.22*volume,{profile:'pluck',group,short:true,endHz:220});
    if(surface==='water')return this.tone(220,delay,.10,.24*volume,{profile:'drum',group,short:true,endHz:110});
  }
  navigationCue({ boundary = null, crossings = [] }, preferences) {
    if (!this.enabled) return 0;
    const coasts=preferences.coastCues!==false?crossings.slice(-2):[];
    if(coasts.length){
      this.cancelTones('coast');
      coasts.forEach((c,i)=>this.crossingCue(c.to,preferences.volume,'coast',i*.10));
    }
    const edge = preferences.boundaryCues !== false && boundary ? boundaryPattern('left') : [];
    if(edge.length){this.cancelTones('navigation');this.playPattern(edge,preferences.volume,'navigation',coasts.length*.10,'drum',mapBoundaryPosition(boundary));}
    return coasts.length*100+(edge.length?(patternDuration(edge)+.16)*1000:0);
  }
  legend(kind, preferences) {
    const { volume, minHz, maxHz } = preferences, middle = Math.sqrt(minHz * maxHz);
    this.cancelTones(); this.fade();
    if (kind === 'pitch') [minHz, middle, maxHz].forEach((f, i) => this.tone(f, i * .5, .35, .08 * volume,{profile:preferences.voiceProfile??'harmonic'}));
    if (kind === 'density') [.2, .5, 1].forEach((d, i) => this.tone(middle, i * .5, .35, .12 * volume * d,{profile:preferences.voiceProfile??'harmonic'}));
    if (kind === 'missing') { this.missingCue(volume, 'legend'); return 750; }
    if(kind==='coast-land'||kind==='coast-water'){this.crossingCue(kind.slice(6),volume,'legend');return 150;}
    if (kind.startsWith('edge-')) {
      const pattern = boundaryPattern('left');
      this.playPattern(pattern, volume, 'legend', 0, 'drum', mapBoundaryPosition(kind.slice(5))); return patternDuration(pattern) * 1000 + 180;
    }
    return 1500;
  }
}
