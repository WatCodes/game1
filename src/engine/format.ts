import type { Num } from './types';

const POWER_UNITS = ['W', 'kW', 'MW', 'GW', 'TW', 'PW', 'EW', 'ZW', 'YW'];
const SI_PREFIXES = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];

function sigfig(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/** SI ladder up to YW, then scientific (GAME_DESIGN §6). */
export function formatPower(n: Num): string {
  if (!isFinite(n)) return '∞ W';
  if (n < 0) return '-' + formatPower(-n);
  if (n < 1000) return (n < 10 ? n.toFixed(1) : Math.floor(n).toString()) + ' W';
  const k = Math.floor(Math.log10(n) / 3);
  if (k < POWER_UNITS.length) return sigfig(n / Math.pow(1000, k)) + ' ' + POWER_UNITS[k];
  return n.toExponential(2).replace('e+', 'e') + ' W';
}

/** Unitless short form for counts/costs shown outside the meter. */
export function formatShort(n: Num): string {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + formatShort(-n);
  if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
  const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];
  const k = Math.floor(Math.log10(n) / 3);
  if (k < suffixes.length) return sigfig(n / Math.pow(1000, k)) + suffixes[k];
  return n.toExponential(2).replace('e+', 'e');
}

/** SI-prefixed electrical readouts: volts, amps, ohms… same ladder as power. */
export function formatUnit(n: Num, unit: string): string {
  if (!isFinite(n)) return `∞ ${unit}`;
  if (n < 0) return '-' + formatUnit(-n, unit);
  if (n < 1000) return (n < 10 ? n.toFixed(1) : Math.floor(n).toString()) + ' ' + unit;
  const k = Math.floor(Math.log10(n) / 3);
  if (k < SI_PREFIXES.length) return sigfig(n / Math.pow(1000, k)) + ' ' + SI_PREFIXES[k] + unit;
  return n.toExponential(2).replace('e+', 'e') + ' ' + unit;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
