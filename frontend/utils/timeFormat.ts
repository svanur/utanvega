/**
 * Format seconds to HH:MM:SS format.
 * @example formatSeconds(3661) => "01:01:01"
 */
export function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Parse HH:MM:SS format to seconds.
 * Accepts: "01:23:45", "1:23:45", "1:23", "83" etc.
 * @example parseTimeString("01:23:45") => 5025
 */
export function parseTimeString(timeStr: string): number {
  const parts = timeStr.trim().split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}
