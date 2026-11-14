import { mapAudio } from './audio-mapping.js';
import { boundaryPattern, patternDuration } from './navigation-cues.js';
import { createSynthVoice, filterSettings } from './synth-voice.js';
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
    this.dataVoice = createSynthVoice(this.context, this.level, 160);
    this.guideVoice = createSynthVoice(this.context, this.guideLevel, 140);
    this.dataVoice.oscillator.start(); this.guideVoice.oscillator.start();
    this.oscillator = this.dataVoice.oscillator;
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
      entry.voice.disconnect(); entry.gain.disconnect(); this.pendingTones.delete(entry);
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
  setSurface(surface, frequency, contrast) {
    // Morph only the filter; neither note retrigger nor surface notification.
    for (const [voice, pitch] of [[this.dataVoice, frequency ?? 160], [this.guideVoice, 140]]) {
      const settings = filterSettings(surface, pitch, contrast);
      this.smooth(voice.filter.frequency, settings.cutoff, .18);
      this.smooth(voice.filter.Q, settings.resonance, .18);
    }
  }
  update(sample, preferences, active, surface = 'unknown') {
    if (this.context && this.lastVolume !== preferences.volume) {
      this.cancelTones(); this.lastVolume = preferences.volume;
    }
    if (!this.enabled || !active || !sample) { this.fade(); return; }
    const { frequency, gain } = mapAudio(sample, preferences);
    this.setSurface(surface, frequency, preferences.surfaceContrast ?? .65);
    if (frequency !== null) {
      if (this.lastValidity === 'no-visual-sample') this.cancelTones('missing');
      this.smooth(this.dataVoice.oscillator.frequency, frequency);
    }
    this.smooth(this.level.gain, gain);
    const guide = frequency === null && ['land', 'water'].includes(surface) && preferences.surfaceGuide !== false;
    this.smooth(this.guideLevel.gain, guide ? .05 * preferences.volume : 0);
    this.lastValidity = sample.validity;
  }
  tone(frequency, delay, duration, gain, { surface = 'unknown', contrast = .65, profile = 'mallet', group = 'legend' } = {}) {
    if (!this.enabled) return;
    const envelope = this.context.createGain();
    const voice = createSynthVoice(this.context, envelope, frequency, { profile });
    const { oscillator } = voice;
    voice.filter.frequency.value = filterSettings(surface, frequency, contrast).cutoff;
    envelope.connect(this.master);
    duration = Math.max(duration, .16);
    const start = this.context.currentTime + delay;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + Math.min(.05, duration / 3));
    envelope.gain.setValueAtTime(gain, start + Math.max(.02, duration * .4));
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    const entry = { oscillator, voice, gain: envelope, group };
    this.pendingTones.add(entry);
    oscillator.onended = () => { this.pendingTones.delete(entry); voice.disconnect(); envelope.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .01);
    return entry;
  }
  playPattern(pattern, volume, group, offset = 0) {
    for (const note of pattern) this.tone(note.hz, note.delay + offset, note.duration, .1 * volume, { group });
  }
  missingCue(volume, group = 'missing') {
    // Explicit legend only: a low, softly filtered swell, never repeated over gaps.
    this.tone(110, 0, .65, .06 * volume, { surface: 'water', group });
  }
  navigationCue({ boundary = null }, preferences) {
    if (!this.enabled) return 0;
    const edge = preferences.boundaryCues !== false ? boundaryPattern(boundary) : [];
    if (!edge.length) return 0;
    this.cancelTones('navigation');
    this.playPattern(edge, preferences.volume * .65, 'navigation');
    return (patternDuration(edge) + .16) * 1000;
  }
  legend(kind, preferences) {
    const { volume, minHz, maxHz } = preferences, middle = Math.sqrt(minHz * maxHz);
    this.cancelTones(); this.fade();
    if (kind === 'pitch') [minHz, middle, maxHz].forEach((f, i) => this.tone(f, i * .5, .35, .08 * volume));
    if (kind === 'density') [.2, .5, 1].forEach((d, i) => this.tone(middle, i * .5, .35, .12 * volume * d));
    if (kind === 'missing') { this.missingCue(volume, 'legend'); return 750; }
    if (kind === 'surface-water' || kind === 'surface-land') {
      this.tone(middle, 0, 1.4, .08 * volume, { surface: kind.slice(8), profile: 'pad', contrast: preferences.surfaceContrast }); return 1500;
    }
    if (kind === 'surface-morph') {
      const entry = this.tone(middle, 0, 2.7, .08 * volume, { surface: 'water', profile: 'pad', contrast: preferences.surfaceContrast });
      if (entry) {
        const now = this.context.currentTime;
        entry.voice.filter.frequency.setTargetAtTime(filterSettings('land', middle, preferences.surfaceContrast).cutoff, now + .9, .18);
        entry.voice.filter.frequency.setTargetAtTime(filterSettings('water', middle, preferences.surfaceContrast).cutoff, now + 1.8, .18);
      }
      return 2800;
    }
    if (kind === 'surface-guide') {
      this.tone(140, 0, .8, .05 * volume, { surface: 'water', profile: 'pad', contrast: preferences.surfaceContrast });
      this.tone(140, 1.1, .8, .05 * volume, { surface: 'land', profile: 'pad', contrast: preferences.surfaceContrast }); return 2050;
    }
    if (kind.startsWith('edge-')) {
      const pattern = boundaryPattern(kind.slice(5));
      this.playPattern(pattern, volume, 'legend'); return patternDuration(pattern) * 1000 + 180;
    }
    return 1500;
  }
}
