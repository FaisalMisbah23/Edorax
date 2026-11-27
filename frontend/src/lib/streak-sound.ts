import { isSoundEnabled, setSoundEnabled } from "@/lib/sound-feedback";

/**
 * Sound for the streak milestone celebration. It is made in the browser with the Web Audio API,
 * so there are no audio files to download. A soft low swell and whoosh, then a bright rising run of
 * bell and mallet notes. Bigger milestones play more notes. No noise crackle, which sounds like static.
 * It follows the app-wide sound setting (and stays silent when the person asks for reduced motion).
 * Browsers only allow sound after the person has touched the page; when it is blocked, nothing plays and nothing breaks.
 */

export function isStreakSoundOff() {
  return !isSoundEnabled();
}

/** The mute button uses the same setting as the rest of the learner sounds. */
export function setStreakSoundOff(off: boolean) {
  setSoundEnabled(!off);
}

// C major pentatonic, going up. The chime plays the first N notes.
const NOTES = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];

function noteCount(days: number) {
  if (days >= 60) return 7;
  if (days >= 30) return 6;
  if (days >= 14) return 5;
  if (days >= 7) return 4;
  return 3;
}

/** One soft bell/mallet note: a clean base tone plus two quick, quiet overtones. */
function bell(ctx: AudioContext, out: AudioNode, frequency: number, at: number, peak: number, decay: number) {
  const partials: Array<[number, number, number]> = [
    [1, 1, decay],
    [2.76, 0.22, decay * 0.35],
    [5.4, 0.1, decay * 0.18],
  ];
  for (const [ratio, level, length] of partials) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * level, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

export function playStreakSound(days: number) {
  if (typeof window === "undefined" || isStreakSoundOff()) return;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    void ctx.resume();
    // A little compressor keeps the loudest moments from clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(limiter);
    const start = ctx.currentTime + 0.02;

    // 1. A warm low swell, like a flame catching.
    const swell = ctx.createOscillator();
    swell.type = "sine";
    swell.frequency.setValueAtTime(150, start);
    swell.frequency.exponentialRampToValueAtTime(70, start + 0.4);
    const swellGain = ctx.createGain();
    swellGain.gain.setValueAtTime(0.0001, start);
    swellGain.gain.exponentialRampToValueAtTime(0.3, start + 0.05);
    swellGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    swell.connect(swellGain).connect(master);
    swell.start(start);
    swell.stop(start + 0.5);

    // 2. A very soft whoosh that opens up and fades.
    const length = 0.55;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, start);
    filter.frequency.exponentialRampToValueAtTime(2200, start + 0.35);
    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.0001, start);
    whooshGain.gain.exponentialRampToValueAtTime(0.12, start + 0.2);
    whooshGain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    whoosh.connect(filter).connect(whooshGain).connect(master);
    whoosh.start(start);

    // 3. The sparkle: a bright rising run. The last note rings longest.
    const count = noteCount(days);
    for (let i = 0; i < count; i += 1) {
      const last = i === count - 1;
      bell(ctx, master, NOTES[i], start + 0.16 + i * 0.1, last ? 0.5 : 0.36, last ? 1.5 : 0.7);
    }

    // 4. A full year gets a warm closing chord.
    if (days >= 365) {
      const at = start + 0.16 + count * 0.1 + 0.08;
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency) => bell(ctx, master, frequency, at, 0.28, 2.2));
    }

    window.setTimeout(() => void ctx.close(), 4500);
  } catch {
    /* Sound is a bonus; never break the celebration. */
  }
}
