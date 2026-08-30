import type { ActivityType, EditionStatus, RaceDto, RaceStatus, ResultType, TicketStatus } from '../hooks/useEvents';
import { formatMinutesToHHmm, normalizeCutoffTimeOnBlur, parseHHmmToMinutes } from './cutoffTime';
import { trimToUndefined } from './strings';
import { hashText } from './translationHash';

export interface RaceFormState {
  eventEditionId: string;
  trailId: string;
  activityType: ActivityType | '';
  name: string;
  nameEn: string;
  distanceLabel: string;
  distanceLabelEn: string;
  cutoffTime: string;
  description: string;
  descriptionEn: string;
  status: RaceStatus;
  sortOrder: string;
  ticketStatus: TicketStatus;
  resultType: ResultType;
  maxParticipants: string;
  itraPoints: string;
  certifiedBy: string;
  certifiedByEn: string;
  prizeMoney: string;
  championshipCategory: string;
  championshipCategoryEn: string;
  dateOfRace: string;
  startTime: string;
  translationHashes?: Record<string, string>;
  _initialNameEn?: string;
  _initialDescriptionEn?: string;
  _initialCertifiedByEn?: string;
  _initialChampionshipCategoryEn?: string;
}

export const RACE_STATUSES: RaceStatus[] = ['Active', 'Completed', 'Cancelled', 'Hidden'];
export const EDITION_STATUSES: EditionStatus[] = ['Active', 'Unconfirmed', 'Cancelled', 'Hidden', 'Completed'];
export const EDITION_STATUS_LABELS: Record<EditionStatus, string> = {
  Active: 'Active',
  Unconfirmed: 'Unconfirmed',
  Cancelled: 'Cancelled',
  Hidden: 'Draft — hidden from all',
  Completed: 'Completed',
};
// Cycling skips Cancelled and Completed — both are terminal states that should be set intentionally,
// not landed on by clicking through a cycle.
export const EDITION_STATUS_CYCLE: EditionStatus[] = ['Active', 'Unconfirmed', 'Hidden'];
export const TICKET_STATUSES: TicketStatus[] = ['Free', 'NotStarted', 'Available', 'AlmostSoldOut', 'SoldOut', 'Closed'];
// null (not yet rated) is a distinct step from 0 (rated at zero points) — keep both in the cycle.
export const ITRA_VALUES: (number | null)[] = [null, 0, 1, 2, 3, 4, 5, 6];
export const ACTIVITY_TYPES: ActivityType[] = ['TrailRunning', 'Running', 'Cycling', 'Hiking', 'FunRun', 'ObstacleCourse', 'CrossCountryRun', 'Swim', 'Canicross', 'IronMan', 'Other'];
export const RESULT_TYPES: ResultType[] = ['Time', 'Distance', 'Laps'];

export function createEmptyRaceForm(eventEditionId = '', sortOrder = 0): RaceFormState {
  return {
    eventEditionId,
    trailId: '',
    activityType: '',
    name: '',
    nameEn: '',
    distanceLabel: '',
    distanceLabelEn: '',
    cutoffTime: '',
    description: '',
    descriptionEn: '',
    status: 'Active',
    sortOrder: String(sortOrder),
    ticketStatus: 'Available',
    resultType: 'Time',
    maxParticipants: '',
    itraPoints: '',
    certifiedBy: '',
    certifiedByEn: '',
    prizeMoney: '0',
    championshipCategory: '',
    championshipCategoryEn: '',
    dateOfRace: '',
    startTime: '',
  };
}

export function buildRaceForm(race: RaceDto): RaceFormState {
  return {
    eventEditionId: race.eventEditionId,
    trailId: race.trailId ?? '',
    activityType: (race.activityType as ActivityType) ?? '',
    name: race.name,
    nameEn: race.nameEn ?? '',
    distanceLabel: race.distanceLabel ?? '',
    distanceLabelEn: race.distanceLabelEn ?? '',
    cutoffTime: formatMinutesToHHmm(race.cutoffMinutes) ?? '',
    description: race.description ?? '',
    descriptionEn: race.descriptionEn ?? '',
    status: race.status,
    sortOrder: race.sortOrder.toString(),
    ticketStatus: race.ticketStatus,
    resultType: race.resultType ?? 'Time',
    maxParticipants: race.maxParticipants?.toString() ?? '',
    itraPoints: race.itraPoints?.toString() ?? '',
    certifiedBy: race.certifiedBy ?? '',
    certifiedByEn: race.certifiedByEn ?? '',
    prizeMoney: race.prizeMoney.toString(),
    championshipCategory: race.championshipCategory ?? '',
    championshipCategoryEn: race.championshipCategoryEn ?? '',
    dateOfRace: race.dateOfRace ?? '',
    startTime: race.startTime ? race.startTime.slice(0, 5) : '',
    translationHashes: race.translationHashes,
    _initialNameEn: race.nameEn ?? '',
    _initialDescriptionEn: race.descriptionEn ?? '',
    _initialCertifiedByEn: race.certifiedByEn ?? '',
    _initialChampionshipCategoryEn: race.championshipCategoryEn ?? '',
  };
}

export function isTxStale(isText: string | null | undefined, enText: string | null | undefined, hash: string | undefined): boolean {
  if (!isText?.trim() || !enText?.trim() || !hash) return false;
  return hashText(isText.trim()) !== hash;
}

export function raceHasStaleTx(race: RaceDto): boolean {
  const h = race.translationHashes ?? {};
  return isTxStale(race.name, race.nameEn, h['Name'])
    || isTxStale(race.description, race.descriptionEn, h['Description'])
    || isTxStale(race.certifiedBy, race.certifiedByEn, h['CertifiedBy'])
    || isTxStale(race.championshipCategory, race.championshipCategoryEn, h['Championship']);
}

export function getRaceStatusColor(status: RaceStatus): 'default' | 'success' | 'info' | 'error' {
  if (status === 'Active') return 'success';
  if (status === 'Completed') return 'info';
  if (status === 'Cancelled') return 'error';
  return 'default';
}

export function getEditionStatusColor(status: EditionStatus): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'Active') return 'success';
  if (status === 'Unconfirmed') return 'warning'; // matches getEventStatusColor's Unconfirmed mapping
  if (status === 'Cancelled') return 'error';
  if (status === 'Completed') return 'info';
  return 'default'; // Hidden
}

export function getTicketStatusColor(status: TicketStatus): 'success' | 'error' | 'warning' | 'info' | 'default' {
  if (status === 'Available' || status === 'Free') return 'success';
  if (status === 'SoldOut') return 'error';
  if (status === 'AlmostSoldOut') return 'warning';
  if (status === 'NotStarted') return 'info';
  return 'default';
}

export interface RaceSavePayload {
  eventEditionId: string;
  trailId: string | null;
  name: string;
  nameEn?: string;
  distanceLabel?: string;
  distanceLabelEn?: string;
  cutoffMinutes: number | null;
  description?: string;
  descriptionEn?: string;
  status: RaceStatus;
  sortOrder: number;
  ticketStatus: TicketStatus;
  resultType: ResultType;
  maxParticipants: number | null;
  itraPoints: number | null;
  certifiedBy?: string;
  certifiedByEn?: string;
  prizeMoney: number;
  championshipCategory?: string;
  championshipCategoryEn?: string;
  dateOfRace: string | null;
  startTime: string | null;
  activityType: ActivityType | null;
  translationHashes?: Record<string, string>;
  _normalizedCutoff: string;
}

export function buildRaceSavePayload(form: RaceFormState): RaceSavePayload {
  const normalizedCutoff = normalizeCutoffTimeOnBlur(form.cutoffTime);
  const cutoffMinutes = parseHHmmToMinutes(normalizedCutoff) ?? null;

  const hashes: Record<string, string> = { ...(form.translationHashes ?? {}) };
  if (form.name?.trim() && form.nameEn?.trim() && form.nameEn !== form._initialNameEn)
    hashes['Name'] = hashText(form.name.trim());
  if (form.description?.trim() && form.descriptionEn?.trim() && form.descriptionEn !== form._initialDescriptionEn)
    hashes['Description'] = hashText(form.description.trim());
  if (form.certifiedBy?.trim() && form.certifiedByEn?.trim() && form.certifiedByEn !== form._initialCertifiedByEn)
    hashes['CertifiedBy'] = hashText(form.certifiedBy.trim());
  if (form.championshipCategory?.trim() && form.championshipCategoryEn?.trim() && form.championshipCategoryEn !== form._initialChampionshipCategoryEn)
    hashes['Championship'] = hashText(form.championshipCategory.trim());

  return {
    eventEditionId: form.eventEditionId,
    trailId: form.trailId || null,
    name: form.name.trim(),
    nameEn: trimToUndefined(form.nameEn),
    distanceLabel: trimToUndefined(form.distanceLabel),
    distanceLabelEn: trimToUndefined(form.distanceLabelEn),
    cutoffMinutes,
    description: trimToUndefined(form.description),
    descriptionEn: trimToUndefined(form.descriptionEn),
    status: form.status,
    sortOrder: form.sortOrder.trim() ? Number(form.sortOrder) : 0,
    ticketStatus: form.ticketStatus,
    resultType: form.resultType,
    maxParticipants: form.maxParticipants.trim() ? Number(form.maxParticipants) : null,
    itraPoints: form.itraPoints.trim() !== '' ? Number(form.itraPoints) : null,
    certifiedBy: trimToUndefined(form.certifiedBy),
    certifiedByEn: trimToUndefined(form.certifiedByEn),
    prizeMoney: form.prizeMoney.trim() ? Number(form.prizeMoney) : 0,
    championshipCategory: trimToUndefined(form.championshipCategory),
    championshipCategoryEn: trimToUndefined(form.championshipCategoryEn),
    dateOfRace: form.dateOfRace || null,
    startTime: form.startTime || null,
    activityType: (form.activityType as ActivityType) || null,
    translationHashes: Object.keys(hashes).length > 0 ? hashes : undefined,
    _normalizedCutoff: normalizedCutoff,
  };
}
