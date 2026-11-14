import { mapAudio } from './audio-mapping.js';
import { boundaryPattern, coastPattern, patternDuration } from './navigation-cues.js';
const LAND_RMS_MATCH = Math.sqrt(1.5);
export class AudioEngine {
  constructor(factory = () => {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) throw new Error('Web Audio is unavailable in this browser.');
    return new AudioContext();
  }) {
    this.factory = factory; this.context = null; this.enabled = false;
    this.epoch = 0; this.pendingTones = new Set(); this.lastValidity = null; this.lastVolume = null;
    this.onInterrupted = () => {};
  }
  setup() {
    if (this.context) return;
    this.context = this.factory();
    this.master = this.context.createGain(); this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    this.level = this.context.createGain(); this.level.gain.value = 0; this.level.connect(this.master);
    this.guideLevel = this.context.createGain(); this.guideLevel.gain.value = 0; this.guideLevel.connect(this.master);
    const voice = (type, target, frequency) => {
      const oscillator = this.context.createOscillator(), mix = this.context.createGain();
      mix.gain.value = type === 'sine' ? 1 : 0;
      oscillator.type = type; oscillator.frequency.value = frequency;
      oscillator.connect(mix); mix.connect(target); oscillator.start();
      return { oscillator, mix };
    };
    this.water = voice('sine', this.level, 160);
    this.land = voice('triangle', this.level, 160);
    this.guideWater = voice('sine', this.guideLevel, 140);
    this.guideLand = voice('triangle', this.guideLevel, 140);
    this.oscillator = this.water.oscillator; // Fundamental retained for audio scheduling diagnostics.
    this.context.onstatechange = () => {
      if (this.enabled && this.context.state !== 'running') { this.stop(); this.onInterrupted(); }
    };
  }
  smooth(parameter, value, timeConstant = .055) {
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
      try { entry.oscillator.stop(); } catch { /* Already ended. */ }
      entry.oscillator.disconnect(); entry.gain.disconnect(); this.pendingTones.delete(entry);
    }
  }
  cancelLegend() { this.cancelTones('legend'); }
  stop() {
    this.epoch++; this.enabled = false; this.lastValidity = null;
    if (!this.context) return;
    for (const node of [this.master, this.level, this.guideLevel]) {
      node.gain.cancelScheduledValues(this.context.currentTime);
      node.gain.setValueAtTime(0, this.context.currentTime);
    }
    this.cancelTones(); this.context.suspend().catch(() => {});
  }
  fade() {
    if (!this.context) return;
    this.smooth(this.level.gain, 0, .04); this.smooth(this.guideLevel.gain, 0, .04);
    this.lastValidity = null;
  }
  setSurface(surface) {
    const isLand = surface === 'land';
    for (const voice of [this.water, this.guideWater]) this.smooth(voice.mix.gain, isLand ? 0 : 1);
    for (const voice of [this.land, this.guideLand]) this.smooth(voice.mix.gain, isLand ? LAND_RMS_MATCH : 0);
  }
  update(sample, preferences, active, surface = 'unknown') {
    if (this.context && this.lastVolume !== preferences.volume) {
      this.cancelTones(); this.lastVolume = preferences.volume;
    }
    if (!this.enabled || !active || !sample) { this.fade(); return; }
    this.setSurface(surface);
    const { frequency, gain } = mapAudio(sample, preferences);
    if (frequency !== null) {
      if (this.lastValidity === 'no-visual-sample') this.cancelTones('missing');
      this.smooth(this.water.oscillator.frequency, frequency);
      this.smooth(this.land.oscillator.frequency, frequency);
    }
    this.smooth(this.level.gain, gain);
    const guide = frequency === null && ['land', 'water'].includes(surface) && preferences.surfaceGuide !== false;
    this.smooth(this.guideLevel.gain, guide ? .05 * preferences.volume : 0);
    if (sample.validity === 'no-visual-sample' && this.lastValidity !== 'no-visual-sample') this.missingCue(preferences.volume);
    this.lastValidity = sample.validity;
  }
  tone(frequency, delay, duration, gain, { type = 'sine', group = 'legend' } = {}) {
    if (!this.enabled) return;
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    oscillator.connect(envelope); envelope.connect(this.master);
    const start = this.context.currentTime + delay;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + .015);
    envelope.gain.setValueAtTime(gain, start + Math.max(.02, duration - .03));
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    const entry = { oscillator, gain: envelope, group };
    this.pendingTones.add(entry);
    oscillator.onended = () => { this.pendingTones.delete(entry); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .01);
  }
  playPattern(pattern, volume, group, offset = 0) {
    for (const note of pattern) this.tone(note.hz, note.delay + offset, note.duration, .1 * volume, { group });
  }
  missingCue(volume, group = 'missing') {
    this.tone(110, 0, .075, .08 * volume, { group });
    this.tone(110, .17, .075, .08 * volume, { group });
  }
  navigationCue({ boundary = null, crossings = [] }, preferences) {
    if (!this.enabled) return 0;
    const edge = preferences.boundaryCues !== false ? boundaryPattern(boundary) : [];
    const coasts = preferences.coastCues !== false ? crossings.slice(-2) : [];
    if (!edge.length && !coasts.length) return 0;
    this.cancelTones('navigation'); this.cancelTones('missing');
    let offset = 0;
    if (edge.length) { this.playPattern(edge, preferences.volume, 'navigation'); offset = patternDuration(edge) + .1; }
    for (const crossing of coasts) {
      const pattern = coastPattern(crossing.to);
      this.playPattern(pattern, preferences.volume, 'navigation', offset);
      offset += patternDuration(pattern) + .08;
    }
    return offset * 1000;
  }
  legend(kind, preferences) {
    const { volume, minHz, maxHz } = preferences, middle = Math.sqrt(minHz * maxHz);
    this.cancelTones(); this.fade();
    if (kind === 'pitch') [minHz, middle, maxHz].forEach((f, i) => this.tone(f, i * .5, .35, .08 * volume));
    if (kind === 'density') [.2, .5, 1].forEach((d, i) => this.tone(middle, i * .5, .35, .12 * volume * d));
    if (kind === 'missing') { this.missingCue(volume, 'legend'); return 300; }
    if (kind === 'surface-water' || kind === 'surface-land') {
      const land = kind === 'surface-land';
      this.tone(middle, 0, .8, .1 * volume * (land ? LAND_RMS_MATCH : 1), { type: land ? 'triangle' : 'sine' }); return 850;
    }
    if (kind === 'surface-guide') {
      this.tone(140, 0, .4, .05 * volume);
      this.tone(140, .65, .4, .05 * volume * LAND_RMS_MATCH, { type: 'triangle' }); return 1100;
    }
    if (kind.startsWith('edge-') || kind.startsWith('coast-')) {
      const pattern = kind.startsWith('edge-') ? boundaryPattern(kind.slice(5)) : coastPattern(kind.slice(6));
      this.playPattern(pattern, volume, 'legend'); return patternDuration(pattern) * 1000 + 50;
    }
    return 1500;
  }
}
