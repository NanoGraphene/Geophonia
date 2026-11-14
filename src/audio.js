import { mapAudio } from './audio-mapping.js';
export class AudioEngine {
  constructor(factory = () => {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) throw new Error('Web Audio is unavailable in this browser.');
    return new AudioContext();
  }) {
    this.factory = factory; this.context = null; this.enabled = false;
    this.epoch = 0; this.pendingTones = new Set(); this.lastValidity = null;
    this.onInterrupted = () => {};
  }
  setup() {
    if (this.context) return;
    this.context = this.factory();
    this.master = this.context.createGain(); this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    this.level = this.context.createGain(); this.level.gain.value = 0;
    this.level.connect(this.master);
    this.oscillator = this.context.createOscillator(); this.oscillator.type = 'sine';
    this.oscillator.connect(this.level); this.oscillator.start();
    this.context.onstatechange = () => {
      if (this.enabled && this.context.state !== 'running') {
        this.stop(); this.onInterrupted();
      }
    };
  }
  async start() {
    const epoch = ++this.epoch;
    this.setup();
    await this.context.resume();
    if (epoch !== this.epoch) { if (!this.enabled) await this.context.suspend(); return false; }
    this.enabled = true;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setValueAtTime(1, this.context.currentTime);
    this.lastValidity = null;
    return true;
  }
  cancelLegend() {
    if (!this.context) return;
    for (const { oscillator, gain } of this.pendingTones) {
      gain.gain.cancelScheduledValues(this.context.currentTime);
      gain.gain.setValueAtTime(0, this.context.currentTime);
      try { oscillator.stop(); } catch { /* Already ended. */ }
      oscillator.disconnect(); gain.disconnect();
    }
    this.pendingTones.clear();
  }
  stop() {
    this.epoch++; this.enabled = false; this.lastValidity = null;
    if (!this.context) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setValueAtTime(0, this.context.currentTime);
    this.level.gain.cancelScheduledValues(this.context.currentTime);
    this.level.gain.setValueAtTime(0, this.context.currentTime);
    this.cancelLegend();
    // Master gain closes synchronously; suspend is a power-saving follow-up.
    this.context.suspend().catch(() => {});
  }
  fade() {
    if (!this.context) return;
    this.level.gain.cancelScheduledValues(this.context.currentTime);
    this.level.gain.setTargetAtTime(0, this.context.currentTime, .04);
    this.lastValidity = null;
  }
  update(sample, preferences, active) {
    if (!this.enabled || !active || !sample) { this.fade(); return; }
    const { frequency, gain } = mapAudio(sample, preferences);
    const time = this.context.currentTime;
    if (frequency !== null) {
      if (this.lastValidity === 'no-visual-sample') this.cancelLegend();
      this.oscillator.frequency.cancelScheduledValues(time);
      this.oscillator.frequency.setTargetAtTime(frequency, time, .055);
    }
    this.level.gain.cancelScheduledValues(time);
    this.level.gain.setTargetAtTime(gain, time, .055);
    if (sample.validity === 'no-visual-sample' && this.lastValidity !== 'no-visual-sample') this.missingCue(preferences.volume);
    this.lastValidity = sample.validity;
  }
  tone(frequency, delay, duration, gain) {
    if (!this.enabled) return;
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    oscillator.connect(envelope); envelope.connect(this.master);
    const start = this.context.currentTime + delay;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + .015);
    envelope.gain.setValueAtTime(gain, start + Math.max(.02, duration - .03));
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    const entry = { oscillator, gain: envelope };
    this.pendingTones.add(entry);
    oscillator.onended = () => { this.pendingTones.delete(entry); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .01);
  }
  missingCue(volume) {
    this.tone(110, 0, .075, .08 * volume);
    this.tone(110, .17, .075, .08 * volume);
  }
  legend(kind, preferences) {
    const { volume, minHz, maxHz } = preferences;
    this.cancelLegend(); this.fade();
    if (kind === 'pitch') [minHz, Math.sqrt(minHz * maxHz), maxHz].forEach((f, i) => this.tone(f, i * .5, .35, .08 * volume));
    if (kind === 'density') [.2, .5, 1].forEach((d, i) => this.tone(Math.sqrt(minHz * maxHz), i * .5, .35, .12 * volume * d));
    if (kind === 'missing') this.missingCue(volume);
    return kind === 'missing' ? 300 : 1500;
  }
}
