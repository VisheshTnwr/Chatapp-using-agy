import type { NotificationSound } from '../types/chat';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

export function playNotificationSound(sound: NotificationSound): void {
  if (sound === 'muted') return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const playTone = (freq: number, start: number, duration: number, type: OscillatorType, gainVal = 0.08) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainVal, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  if (sound === 'chime') {
    playTone(587.33, now, 0.16, 'sine', 0.07);
    playTone(880, now + 0.09, 0.24, 'sine', 0.08);
  } else if (sound === 'pop') {
    playTone(440, now, 0.08, 'triangle', 0.09);
    playTone(660, now + 0.04, 0.09, 'sine', 0.07);
  } else if (sound === 'crystal') {
    playTone(1046.5, now, 0.14, 'sine', 0.06);
    playTone(1318.5, now + 0.07, 0.16, 'sine', 0.06);
    playTone(1567.98, now + 0.14, 0.25, 'sine', 0.05);
  }
}

export function playSendSound(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(760, now + 0.07);
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.09);
}
