import confetti from 'canvas-confetti';

export function haptic(ms = 12) { try { (navigator as any).vibrate?.(ms); } catch {} }
export function celebrate() {
  try { confetti({ particleCount: 90, spread: 72, origin: { y: 0.7 }, colors: ['#B8460E', '#4A6741', '#3B5C6B', '#C8932E', '#8E4585'] }); } catch {}
  haptic(25);
}
