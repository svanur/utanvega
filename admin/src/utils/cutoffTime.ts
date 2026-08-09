export function normalizeCutoffTimeInput(value: string): string {
  const compact = value.replace(/\s/g, '');
  if (compact.includes(':')) {
    const [rawHours, rawMinutes = ''] = compact.split(':', 2);
    const hours = rawHours.replace(/\D/g, '').slice(0, 2);
    const minutes = rawMinutes.replace(/\D/g, '').slice(0, 2);
    if (!hours && !minutes) return '';
    if (!hours) return `0:${minutes}`;
    return `${hours}:${minutes}`;
  }
  const digits = compact.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function normalizeCutoffTimeOnBlur(value: string): string {
  const compact = value.replace(/\s/g, '');
  const colonMatch = /^(\d{1,2}):(\d{1,2})$/.exec(compact);
  if (colonMatch) {
    const hours = Number(colonMatch[1]);
    const minutes = Number(colonMatch[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return value;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  const digits = compact.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  let hours = 0;
  let minutes = 0;
  if (digits.length <= 2) {
    hours = Number(digits);
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    minutes = Number(digits.slice(1));
  } else {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2));
  }
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return value;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function parseHHmmToMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /^(\d+):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return (hours * 60) + minutes;
}

export function splitMinutes(value: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(value));
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function formatMinutesToHHmm(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  const { hours, minutes } = splitMinutes(value);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
