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

/**
 * Format an ISO date (YYYY-MM-DD) to a localized date string.
 */
export function formatDateForDisplay(dateStr?: string, locale = 'en-GB'): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;

  const yearNum = Number(year);
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (!Number.isFinite(yearNum) || !Number.isFinite(monthNum) || !Number.isFinite(dayNum)) {
    return dateStr;
  }

  const utcDate = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDate);
}

/**
 * Format an ISO date (YYYY-MM-DD) with i18n month names.
 * Icelandic: "4. maí 2026"
 * English: "May 4, 2026"
 */
export function formatDateWithMonths(dateStr: string | undefined, months: string[], isIcelandic: boolean): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;

  const yearNum = Number(year);
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (!Number.isFinite(yearNum) || !Number.isFinite(monthNum) || !Number.isFinite(dayNum)) {
    return dateStr;
  }

  const monthName = months[monthNum - 1] ?? month;
  return isIcelandic
    ? `${dayNum}. ${monthName} ${yearNum}`
    : `${monthName} ${dayNum}, ${yearNum}`;
}
