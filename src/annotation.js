// This is a renderer boundary, not merely an AI prompt convention.
// Definitions and uncertain etymologies are knowledge-layer data only.
export function safeOriginal(entry, surface = '') {
  if (!entry || typeof entry.sourceWordConfidence!=='number' || !Number.isFinite(entry.sourceWordConfidence) || entry.sourceWordConfidence < .9 || entry.sourceWordConfidence > 1) return '';
  if (entry.etymologyKind !== 'borrowed') return '';
  const value = entry.sourceWord || '';
  if (typeof value !== 'string' || value !== value.trim() || value.length > 28 || value.split(' ').length > 3) return '';
  if (!/^[\p{Script=Latin}\p{M}]+(?:[ '-][\p{Script=Latin}\p{M}]+)*$/u.test(value)) return '';
  if (surface && value.length > Math.max(8, surface.length * 3)) return '';
  return value;
}
export function safeReading(reading) {
  return typeof reading === 'string' && reading.length <= 32 && /^[\p{Script=Hiragana}ー]+$/u.test(reading) ? reading : '';
}
