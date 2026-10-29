import { describe, it, expect, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { toggleCheckIn } from './trailCheckInToggle';

// t() isn't exercised beyond its two keys in this module, so a stub that echoes the
// key back (rather than the real i18next instance) is enough to assert on.
const t = ((key: string) => key) as TFunction;

function baseOptions(overrides: Partial<Parameters<typeof toggleCheckIn>[0]> = {}) {
    return {
        user: { id: 'user-1' },
        isCheckedIn: false,
        checkIn: vi.fn().mockResolvedValue(undefined),
        checkOut: vi.fn().mockResolvedValue(undefined),
        t,
        setLoginModalOpen: vi.fn(),
        setCheckInError: vi.fn(),
        setToastSeverity: vi.fn(),
        setToastMessage: vi.fn(),
        markSuppressRealtimeToast: vi.fn(),
        ...overrides,
    };
}

describe('toggleCheckIn (#1568)', () => {
    it('checks in and shows the checked-in toast when not currently checked in', async () => {
        const options = baseOptions({ isCheckedIn: false });

        await toggleCheckIn(options);

        expect(options.checkIn).toHaveBeenCalledTimes(1);
        expect(options.checkOut).not.toHaveBeenCalled();
        expect(options.setToastSeverity).toHaveBeenCalledWith('info');
        expect(options.setToastMessage).toHaveBeenCalledWith('trail.checkInToastCheckedIn');
        expect(options.setCheckInError).toHaveBeenCalledWith(null);
        expect(options.markSuppressRealtimeToast).toHaveBeenCalledTimes(1);
    });

    it('checks out and shows the checked-out toast when currently checked in', async () => {
        const options = baseOptions({ isCheckedIn: true });

        await toggleCheckIn(options);

        expect(options.checkOut).toHaveBeenCalledTimes(1);
        expect(options.checkIn).not.toHaveBeenCalled();
        expect(options.setToastSeverity).toHaveBeenCalledWith('info');
        expect(options.setToastMessage).toHaveBeenCalledWith('trail.checkInToastCheckedOut');
    });

    it('sets checkInError and shows no toast when checkIn rejects with an Error', async () => {
        const checkIn = vi.fn().mockRejectedValue(new Error('server exploded'));
        const options = baseOptions({ isCheckedIn: false, checkIn });

        await toggleCheckIn(options);

        expect(options.setCheckInError).toHaveBeenCalledWith('server exploded');
        expect(options.setToastSeverity).not.toHaveBeenCalled();
        expect(options.setToastMessage).not.toHaveBeenCalled();
    });

    it('sets checkInError and shows no toast when checkOut rejects with an Error', async () => {
        const checkOut = vi.fn().mockRejectedValue(new Error('conflict'));
        const options = baseOptions({ isCheckedIn: true, checkOut });

        await toggleCheckIn(options);

        expect(options.setCheckInError).toHaveBeenCalledWith('conflict');
        expect(options.setToastSeverity).not.toHaveBeenCalled();
        expect(options.setToastMessage).not.toHaveBeenCalled();
    });

    it('falls back to the translated generic message when a non-Error is thrown', async () => {
        const checkIn = vi.fn().mockRejectedValue('not an Error instance');
        const options = baseOptions({ isCheckedIn: false, checkIn });

        await toggleCheckIn(options);

        expect(options.setCheckInError).toHaveBeenCalledWith('trail.checkInActionFailed');
    });

    it('opens the login modal and does not call checkIn/checkOut when user is null', async () => {
        const options = baseOptions({ user: null });

        await toggleCheckIn(options);

        expect(options.setLoginModalOpen).toHaveBeenCalledWith(true);
        expect(options.checkIn).not.toHaveBeenCalled();
        expect(options.checkOut).not.toHaveBeenCalled();
        expect(options.setCheckInError).not.toHaveBeenCalled();
    });
});
