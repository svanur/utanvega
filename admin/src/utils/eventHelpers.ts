import type { EventEditionDto } from '../hooks/useEvents';

export const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
  return `${d}. ${months[(m ?? 1) - 1]} ${y}`;
}

export function isPastDate(dateStr: string): boolean {
  return !!dateStr && dateStr < new Date().toISOString().slice(0, 10);
}

export function bumpYearInUrl(url: string, fromYear: number | null | undefined, toYear: number): string {
  if (!url || !fromYear) return url;
  return url.split(String(fromYear)).join(String(toYear));
}

export function suggestEditionDateForYear(prevDateStr: string | null | undefined, toYear: number): string {
  if (!prevDateStr) return '';
  const prev = new Date(prevDateStr + 'T00:00:00');
  const candidate = new Date(prev);
  candidate.setFullYear(toYear);
  const diff = prev.getDay() - candidate.getDay();
  candidate.setDate(candidate.getDate() + (Math.abs(diff) <= 3 ? diff : diff > 0 ? diff - 7 : diff + 7));
  return candidate.toISOString().slice(0, 10);
}

export function suggestEditionEndDateForYear(
  prevStartStr: string | null | undefined,
  prevEndStr: string | null | undefined,
  newStartStr: string,
): string {
  if (!prevStartStr || !prevEndStr || !newStartStr) return '';
  const durationDays = Math.round(
    (new Date(prevEndStr + 'T00:00:00').getTime() - new Date(prevStartStr + 'T00:00:00').getTime()) / 86400000,
  );
  if (durationDays <= 0) return '';
  const newEnd = new Date(newStartStr + 'T00:00:00');
  newEnd.setDate(newEnd.getDate() + durationDays);
  return newEnd.toISOString().slice(0, 10);
}

export function computeClonedRaceDate(
  sourceEditionDate: string | null | undefined,
  raceDateOfRace: string | null | undefined,
  newEditionDate: string | null | undefined,
): string | null {
  if (!sourceEditionDate || !raceDateOfRace || !newEditionDate) return null;
  const offsetDays = Math.round(
    (new Date(raceDateOfRace + 'T00:00:00').getTime() - new Date(sourceEditionDate + 'T00:00:00').getTime()) / 86400000,
  );
  const newDate = new Date(newEditionDate + 'T00:00:00');
  newDate.setDate(newDate.getDate() + offsetDays);
  return newDate.toISOString().slice(0, 10);
}

export function sortEditions(a: EventEditionDto, b: EventEditionDto): number {
  if (a.date && b.date) return b.date.localeCompare(a.date);
  if (a.date) return -1;
  if (b.date) return 1;
  if (a.year != null && b.year != null) return b.year - a.year;
  return 0;
}

// Mirrors backend Event.CancelWithEditions: an event-level cancellation cascades to editions that
// are not already Completed, not already Cancelled, and whose effective date (EndDate ?? Date) is
// either undated or still in the future — past-dated Active/Unconfirmed editions are stale data,
// not upcoming events, and are left untouched by the cascade.
export function editionsAffectedByEventCancel(editions: EventEditionDto[]): EventEditionDto[] {
  const today = new Date().toISOString().slice(0, 10);
  return editions.filter(ed => {
    if (ed.status === 'Completed' || ed.status === 'Cancelled') return false;
    const effectiveDate = ed.endDate ?? ed.date;
    return !effectiveDate || effectiveDate >= today;
  });
}
