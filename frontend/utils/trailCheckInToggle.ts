import type { TFunction } from 'i18next';

/**
 * Toggles a trail check-in/check-out, branching on the current isCheckedIn state and on
 * checkIn()/checkOut() success vs. a thrown error. Extracted out of TrailDetailsPage's
 * handleToggleCheckIn (#1568, same class of gap as #1559's downloadTrailGpx extraction)
 * so the branching logic is unit-testable independently of the component — see
 * trailCheckInToggle.test.ts.
 *
 * `user`/`setLoginModalOpen` are included so the not-logged-in early-return stays
 * byte-for-byte equivalent to the original inline handler.
 */
export interface CheckInToggleOptions {
    user: unknown | null;
    isCheckedIn: boolean;
    checkIn: () => Promise<unknown>;
    checkOut: () => Promise<unknown>;
    t: TFunction;
    setLoginModalOpen: (open: boolean) => void;
    setCheckInError: (message: string | null) => void;
    setToastSeverity: (severity: 'info' | 'error') => void;
    setToastMessage: (message: string | null) => void;
    markSuppressRealtimeToast: () => void;
}

export async function toggleCheckIn(options: CheckInToggleOptions): Promise<void> {
    const {
        user,
        isCheckedIn,
        checkIn,
        checkOut,
        t,
        setLoginModalOpen,
        setCheckInError,
        setToastSeverity,
        setToastMessage,
        markSuppressRealtimeToast,
    } = options;

    if (!user) {
        setLoginModalOpen(true);
        return;
    }

    setCheckInError(null);
    try {
        markSuppressRealtimeToast();
        if (isCheckedIn) {
            await checkOut();
            setToastSeverity('info');
            setToastMessage(t('trail.checkInToastCheckedOut'));
        } else {
            await checkIn();
            setToastSeverity('info');
            setToastMessage(t('trail.checkInToastCheckedIn'));
        }
    } catch (error) {
        setCheckInError(error instanceof Error ? error.message : t('trail.checkInActionFailed'));
    }
}
