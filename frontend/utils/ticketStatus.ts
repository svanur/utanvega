export interface DistanceEntry {
    label: string;
    ticketStatus: string | null;
    // Optional — only the editions history page populates these. Absent for every other caller
    // of groupDistances (RacesPage/EventTableView), which is fine since they're never read there.
    elevationGain?: number | null;
    terrainType?: string | null;
}
export interface GroupedDistance {
    label: string;
    count: number;
    ticketStatus: string | null;
    // Only set when every race collapsed into this group agrees on the value (or there's only one) —
    // see groupDistances below for why a mismatch clears it rather than picking one arbitrarily.
    elevationGain?: number | null;
    terrainType?: string | null;
}

export function groupDistances(distances: DistanceEntry[]): GroupedDistance[] {
    const map = new Map<string, GroupedDistance>();
    for (const d of distances) {
        const existing = map.get(d.label);
        if (existing) {
            existing.count++;
            // Escalate ticket status: SoldOut > AlmostSoldOut > Closed > Available > null
            if (d.ticketStatus === 'SoldOut') existing.ticketStatus = 'SoldOut';
            else if (d.ticketStatus === 'AlmostSoldOut' && existing.ticketStatus !== 'SoldOut') existing.ticketStatus = 'AlmostSoldOut';
            // Two races can share a distance label (e.g. both "10 km") while running different
            // courses with different elevation/terrain. Rather than silently keeping whichever
            // race's values happened to be seen first, clear the field the moment two races
            // sharing the label disagree — an absent fact reads honestly, a wrong one doesn't.
            if (existing.elevationGain !== (d.elevationGain ?? null)) existing.elevationGain = null;
            if (existing.terrainType !== (d.terrainType ?? null)) existing.terrainType = null;
        } else {
            map.set(d.label, {
                label: d.label,
                count: 1,
                ticketStatus: d.ticketStatus,
                elevationGain: d.elevationGain ?? null,
                terrainType: d.terrainType ?? null,
            });
        }
    }
    return Array.from(map.values());
}

// #1317: extracted from RacesPage.tsx's justRaced ("Recently completed") card block (#1305/#1312)
// so the distance/chip-row fallback branching is unit-tested instead of living inline in a ~1800-line
// component. Output must match the original derivation exactly — this is a refactor, not a behavior
// change.
//
// #1305: this section's cards fold a single distance into the date line instead of a separate chip
// row — only fall back to the chip row (as the upcoming list does) when there's more than one
// distance to show, so no information is silently lost.
// #1312: recentRace's own distanceLabel can legitimately be null (no length on the race or its
// linked trail — GetEventsQuery.cs). In that case there's nothing to fold into the date line, so
// fall back to the season's other races (distances) for the chip row instead of showing no distance
// info at all. The inline label itself must stay sourced from recentRace.distanceLabel only — never
// substituted.
export function getRecentRaceDistanceDisplay(
    recentRace: { distanceLabel: string | null } | null | undefined,
    distances: DistanceEntry[] | null | undefined
): { groupedDistances: GroupedDistance[]; singleDistanceLabel: string | null; showDistanceChips: boolean } {
    const recentRaceHasDistanceLabel = !!recentRace?.distanceLabel;
    const groupedDistances = (!recentRace || !recentRaceHasDistanceLabel) && distances
        ? groupDistances(distances)
        : [];
    const singleDistanceLabel = recentRace
        ? recentRace.distanceLabel
        : groupedDistances.length === 1
            ? groupedDistances[0].label
            : null;
    // Non-recentRace single distance is already shown inline above (via singleDistanceLabel), so
    // the chip row there only fires above 1. The recentRace-with-no-distanceLabel fallback has
    // shown nothing inline, so even a single grouped distance needs the chip row to surface it.
    const showDistanceChips = recentRace
        ? groupedDistances.length > 0
        : groupedDistances.length > 1;
    return { groupedDistances, singleDistanceLabel, showDistanceChips };
}

// Returns true when every race in the relevant edition is sold out — used to suppress registration UI (button, swipe action)
export function isAllSoldOut(distances: DistanceEntry[] | null | undefined): boolean {
    if (!distances || distances.length === 0) return false;
    return distances.every(d => d.ticketStatus === 'SoldOut' || d.ticketStatus === 'Closed');
}

// Returns false only when registration isn't needed at all (free entry, no sign-up) — used to
// suppress registration UI (button, swipe action) alongside isAllSoldOut above.
//
// Event/edition scope only (e.g. EventEditionDto.registrationStatus, or an event's single
// "relevant edition" registrationStatus) — never use this for an individual race inside a Series
// event's seriesRaces, since those can span multiple editions each with their own registration
// window. Use isRegistrationRequiredForRace below for that case.
export function isRegistrationRequired(registrationStatus: string | null | undefined): boolean {
    return registrationStatus !== 'NotRequired' && registrationStatus !== 'Invitational';
}

// Per-race equivalent of isRegistrationRequired, for Series events where seriesRaces/races can
// belong to different editions than the one registrationStatus reflects. SeriesRaceDto.ticketStatus
// is derived per-race by the backend (EditionStatusHelpers.ComputeEffectiveTicketStatus), which maps
// RegistrationStatus.NotRequired -> TicketStatus.Free and only NotRequired maps to Free — so 'Free'
// here reliably means "this specific race's edition needs no registration."
export function isRegistrationRequiredForRace(ticketStatus: string | null | undefined): boolean {
    return ticketStatus !== 'Free' && ticketStatus !== 'Invitational';
}

// RegistrationCloses now carries real time-of-day precision for editions entered via
// EventDetailPage's DateTimePicker (#1071), but legacy rows and every edition still created via
// EventWizardPage's date-only DatePicker store exact midnight-UTC. Comparing those directly
// against `now` would flip them to Closed a full day early. Midnight UTC isn't a plausible real
// closing instant, so treat it as the date-only fudge and roll it forward to the end of that day;
// any other time-of-day is a genuine DateTimePicker instant and is compared as-is. Mirrors the
// backend's EditionStatusHelpers.ComputeEffectiveRegistrationStatus so UI gated on this value
// (e.g. the resale link) flips at the same moment RegistrationStatus itself would read Closed.
export function hasRegistrationClosed(registrationCloses: string | null | undefined, now: Date = new Date()): boolean {
    if (!registrationCloses) return false;
    const closes = new Date(registrationCloses);
    const isMidnightUtc = closes.getUTCHours() === 0 && closes.getUTCMinutes() === 0 &&
        closes.getUTCSeconds() === 0 && closes.getUTCMilliseconds() === 0;
    const effectiveCloses = isMidnightUtc
        ? new Date(closes.getTime() + 24 * 60 * 60 * 1000)
        : closes;
    return now.getTime() >= effectiveCloses.getTime();
}

// Per-race equivalent of the registration-window precision above, but for when the race *starts*
// rather than when registration closes. When startTime is set, compare `now` against the combined
// date+time instant so the Register button hides the moment the race actually starts, not at the
// end of its calendar day. When startTime is absent (today's common case — most races have no
// recorded start time), fall back to the pre-existing day-granularity rule: not started until the
// day after dateOfRace (mirrors getRowDaysUntil/daysBetween in eventUtils.ts, i.e. `raceDaysUntil
// >= 0` reading as "not yet started").
export function hasRaceStarted(dateOfRace: string | null | undefined, startTime: string | null | undefined, now: Date = new Date()): boolean {
    if (!dateOfRace) return false;
    if (startTime) {
        const start = new Date(`${dateOfRace}T${startTime}`);
        return now.getTime() >= start.getTime();
    }
    // Day-granularity fallback — local midnight so a same-day race never reads as started no
    // matter how late in the day `now` is, matching daysBetween's local-midnight normalization.
    const raceDay = new Date(`${dateOfRace}T00:00:00`);
    raceDay.setDate(raceDay.getDate() + 1);
    return now.getTime() >= raceDay.getTime();
}

export function getTicketStatusColor(status: string | null): 'success' | 'error' | 'warning' | 'info' | 'default' {
    switch (status) {
        case 'Free': return 'success';
        case 'Available': return 'success';
        case 'AlmostSoldOut': return 'warning';
        case 'SoldOut': return 'error';
        case 'NotStarted': return 'info';
        case 'Closed': return 'default';
        case 'Invitational': return 'default';
        default: return 'default';
    }
}
