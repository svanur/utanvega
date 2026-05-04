/**
 * Convert HH:MM:SS format to total seconds
 * @param timeStr Time in HH:MM:SS format
 * @returns Total seconds
 */
export function timeStringToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 3) return 0;
  
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseInt(parts[2], 10) || 0;
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Convert seconds to HH:MM:SS format
 * @param totalSeconds Total seconds
 * @returns Time in HH:MM:SS format
 */
export function secondsToTimeString(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return '00:00:00';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
