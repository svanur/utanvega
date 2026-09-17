import type { Dayjs } from 'dayjs';
import type { EventEditionDto } from '../hooks/useEvents';

export interface YearMonthFilterable {
  hasFutureEdition: boolean;
  nextEditionDate: string | null;
}

export const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Icelandic full month names, used for the copy-to-clipboard agenda text (handleCopyAgenda) —
// that text is pasted into public-facing Icelandic content, unlike the rest of admin's
// English-only UI, so it intentionally does not reuse MONTHS/MONTHS_SHORT above.
export const MONTHS_IS_FULL = ['', 'janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];

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

// The Month <Select> on the events list (EventsListPage) is disabled whenever yearFilter is
// 'all', and the Year <Select>'s onChange resets monthFilter back to 'all' the moment Year
// changes — so click-through can never produce "Month set, Year = 'all'". A hand-edited or
// bookmarked URL (e.g. ?monthFilter=09 with no yearFilter) can still reach that state, though,
// since useUrlFilterState validates each param independently. Without this guard that would
// silently filter to "this month, any year" rather than doing nothing, which is what the
// (disabled) Month dropdown implies. See #734.
export function matchesYearMonthFilter(e: YearMonthFilterable, yearFilter: string, monthFilter: string): boolean {
  if (yearFilter === 'all') return true;
  if (!e.hasFutureEdition) return true;
  if (!e.nextEditionDate || e.nextEditionDate.slice(0, 4) !== yearFilter) return false;
  if (monthFilter !== 'all' && e.nextEditionDate.slice(5, 7) !== monthFilter) return false;
  return true;
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

// dayjs().day() is 0 (Sun) – 6 (Sat). Plain `(8 - today.day()) % 7` gives 0 rather than 7 when
// today is Monday (day() === 1: (8-1)%7 === 0), which would resolve "next week" to today instead
// of 7 days out — the `|| 7` guards that case. Result is always 1–7, never 0/negative, so
// `today.add(offset, 'day')` always lands on the following week's Monday. See #836.
export function nextWeekMondayOffset(today: Dayjs): number {
  return (8 - today.day()) % 7 || 7;
}

// dayjs().day() is 0 (Sun) – 6 (Sat). `(today.day() + 6) % 7` maps Monday (1) to 0, Tuesday (2)
// to 1, ..., Sunday (0) to 6 — i.e. how many days to go back to reach this week's Monday. Result
// is always 0–6, so `today.subtract(offset, 'day')` always lands on the current week's Monday.
// Mirrors nextWeekMondayOffset above. See #847.
export function thisWeekMondayOffset(today: Dayjs): number {
  return (today.day() + 6) % 7;
}

// Header for the copy-to-clipboard agenda (handleCopyAgenda on EventsListPage) when a week
// filter ('this-week' | 'next-week') is active — e.g. "13. – 20. september 2026" for a range
// within one month, or "29. desember – 4. janúar 2027" across a month/year boundary. See #836.
export function formatAgendaHeader(start: Dayjs, end: Dayjs): string {
  const sameMonth = start.month() === end.month();
  return sameMonth
    ? `${start.date()}. – ${end.date()}. ${MONTHS_IS_FULL[end.month() + 1]} ${end.year()}`
    : `${start.date()}. ${MONTHS_IS_FULL[start.month() + 1]} – ${end.date()}. ${MONTHS_IS_FULL[end.month() + 1]} ${end.year()}`;
}
