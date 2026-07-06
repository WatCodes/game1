// Synthesized control-room audio — no asset files. A low grid hum tracks
// power output; short blips punctuate toasts. Browsers require a user
// gesture before audio starts, so App primes on first pointerdown.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let humOsc: OscillatorNode | null = null;
let humGain: GainNode | null = null;
let enabled = typeof localStorage !== 'undefined' && localStorage.getItem('kardashev:ui:audio') !== '0';

export function audioEnabled(): boolean {
  return enabled;
}

export function setAudioEnabled(on: boolean): void {
  enabled = on;
  localStorage.setItem('kardashev:ui:audio', on ? '1' : '0');
  if (!on && ctx) void ctx.suspend();
  if (on) prime();
}

/** Start (or resume) the audio graph. Safe to call repeatedly. */
export function prime(): void {
  if (!enabled || typeof window === 'undefined' || !('AudioContext' in window)) return;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    // the hum: a filtered low sawtooth, gain driven by pps
    humOsc = ctx.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 50;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    humGain = ctx.createGain();
    humGain.gain.value = 0;
    humOsc.connect(filter).connect(humGain).connect(master);
    humOsc.start();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

/** Called as the display updates: hum volume/pitch scale with log output. */
export function setHum(pps: number): void {
  if (!ctx || !humGain || !humOsc || !enabled) return;
  const level = pps <= 0 ? 0 : Math.min(0.045, 0.006 + Math.log10(1 + pps) * 0.0016);
  humGain.gain.setTargetAtTime(level, ctx.currentTime, 0.6);
  humOsc.frequency.setTargetAtTime(48 + Math.min(30, Math.log10(1 + pps) * 1.2), ctx.currentTime, 0.8);
}

const BLIP_FREQ: Record<string, number> = {
  milestone: 660,
  research: 520,
  stage: 440,
  ascend: 392,
  info: 580,
  error: 180,
};

/** Short synth blip per toast kind; 'ascend' plays a rising fifth. */
export function blip(kind: string): void {
  if (!ctx || !master || !enabled || ctx.state !== 'running') return;
  const freq = BLIP_FREQ[kind] ?? 580;
  const notes = kind === 'ascend' ? [freq, freq * 1.5] : [freq];
  notes.forEach((f, i) => {
    const t = ctx!.currentTime + i * 0.12;
    const osc = ctx!.createOscillator();
    osc.type = kind === 'error' ? 'square' : 'triangle';
    osc.frequency.value = f;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g).connect(master!);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}
