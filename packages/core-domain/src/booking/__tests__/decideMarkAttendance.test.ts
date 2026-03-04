/**
 * Unit-тесты на каждый вариант ok: false с конкретной reason для decideMarkAttendanceUseCase.
 */

import { decideMarkAttendanceUseCase } from '../useCases';
import type { BookingRepository } from '../../ports/repositories';
import type { BookingStatus } from '../types';

const BIZ_ID = 'biz-1';
const BOOKING_ID = 'booking-1';

function makeBooking(overrides: Partial<{
    id: string;
    biz_id: string;
    status: BookingStatus;
    start_at: string;
}> = {}) {
    return {
        id: BOOKING_ID,
        biz_id: BIZ_ID,
        branch_id: 'branch-1',
        service_id: 'svc-1',
        staff_id: 'staff-1',
        status: 'confirmed' as BookingStatus,
        promotion_applied: null,
        start_at: '2024-01-01T10:00:00Z',
        ...overrides,
    };
}

describe('decideMarkAttendanceUseCase', () => {
    const past = new Date('2024-01-01T09:00:00Z'); // до начала брони
    const now = new Date('2024-06-01T12:00:00Z');  // после начала брони

    describe('ok: false — каждый reason', () => {
        it('returns BOOKING_NOT_FOUND when booking does not exist', async () => {
            const repo: BookingRepository = {
                findById: jest.fn().mockResolvedValue(null),
                updateStatus: jest.fn(),
            };
            const result = await decideMarkAttendanceUseCase(
                { bookingRepository: repo, now: () => now },
                { bookingId: BOOKING_ID, bizId: BIZ_ID, attended: true },
            );
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.reason).toBe('BOOKING_NOT_FOUND');
                expect(result.currentStatus).toBeUndefined();
            }
            expect(repo.findById).toHaveBeenCalledWith(BOOKING_ID);
        });

        it('returns BOOKING_NOT_IN_BIZ when booking belongs to another business', async () => {
            const repo: BookingRepository = {
                findById: jest.fn().mockResolvedValue(makeBooking({ biz_id: 'other-biz' })),
                updateStatus: jest.fn(),
            };
            const result = await decideMarkAttendanceUseCase(
                { bookingRepository: repo, now: () => now },
                { bookingId: BOOKING_ID, bizId: BIZ_ID, attended: true },
            );
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.reason).toBe('BOOKING_NOT_IN_BIZ');
                expect(result.currentStatus).toBe('confirmed');
            }
        });

        it('returns BOOKING_ALREADY_FINAL when status is paid', async () => {
            const repo: BookingRepository = {
                findById: jest.fn().mockResolvedValue(makeBooking({ status: 'paid' })),
                updateStatus: jest.fn(),
            };
            const result = await decideMarkAttendanceUseCase(
                { bookingRepository: repo, now: () => now },
                { bookingId: BOOKING_ID, bizId: BIZ_ID, attended: true },
            );
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.reason).toBe('BOOKING_ALREADY_FINAL');
                expect(result.currentStatus).toBe('paid');
            }
        });

        it('returns BOOKING_ALREADY_FINAL when status is no_show', async () => {
            const repo: BookingRepository = {
                findById: jest.fn().mockResolvedValue(makeBooking({ status: 'no_show' })),
                updateStatus: jest.fn(),
            };
            const result = await decideMarkAttendanceUseCase(
                { bookingRepository: repo, now: () => now },
                { bookingId: BOOKING_ID, bizId: BIZ_ID, attended: false },
            );
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.reason).toBe('BOOKING_ALREADY_FINAL');
                expect(result.currentStatus).toBe('no_show');
            }
        });

        it('returns BOOKING_ALREADY_FINAL when status is cancelled', async () => {
            const repo: BookingRepository = {
                findById: jest.fn().mockResolvedValue(makeBooking({ status: 'cancelled' })),
                updateStatus: jest.fn(),
            };
            const result = await decideMarkAttendanceUseCase(
                { bookingRepository: repo, now: () => now },
                { bookingId: BOOKING_ID, bizId: BIZ_ID, attended: true },
            );
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.reason).toBe('BOOKING_ALREADY_FINAL');
                expect(result.currentStatus).toBe('cancelled');
            }
        });

        it('returns BOOKING_NOT_IN_PAST when start_at is invalid (NaN)', async () => {
            const repo: BookingRepository = {
                findById: jest.fn().mockResolvedValue(makeBooking({ start_at: 'not-a-date' })),
                updateStatus: jest.fn(),
            };
            const result = await decideMarkAttendanceUseCase(
                { bookingRepository: repo, now: () => now },
                { bookingId: BOOKING_ID, bizId: BIZ_ID, attended: true },
            );
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.reason).toBe('BOOKING_NOT_IN_PAST');
                expect(result.currentStatus).toBe('confirmed');
            }
        });

        it('returns BOOKING_NOT_IN_PAST when booking start is in the future', async () => {
            const futureStart = '2025-12-31T10:00:00Z';
            const repo: BookingRepository = {
                findById: jest.fn().mockResolvedValue(makeBooking({ start_at: futureStart })),
                updateStatus: jest.fn(),
            };
            const result = await decideMarkAttendanceUseCase(
                { bookingRepository: repo, now: () => now },
                { bookingId: BOOKING_ID, bizId: BIZ_ID, attended: true },
            );
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.reason).toBe('BOOKING_NOT_IN_PAST');
                expect(result.currentStatus).toBe('confirmed');
            }
        });
    });

    describe('ok: true', () => {
        it('returns newStatus paid and applyPromotion true when attended=true', async () => {
            const repo: BookingRepository = {
                findById: jest.fn().mockResolvedValue(makeBooking({ status: 'confirmed', start_at: '2024-01-01T10:00:00Z' })),
                updateStatus: jest.fn(),
            };
            const result = await decideMarkAttendanceUseCase(
                { bookingRepository: repo, now: () => now },
                { bookingId: BOOKING_ID, bizId: BIZ_ID, attended: true },
            );
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.newStatus).toBe('paid');
                expect(result.applyPromotion).toBe(true);
                expect(result.currentStatus).toBe('confirmed');
            }
        });

        it('returns newStatus no_show and applyPromotion false when attended=false', async () => {
            const repo: BookingRepository = {
                findById: jest.fn().mockResolvedValue(makeBooking({ status: 'hold', start_at: '2024-01-01T10:00:00Z' })),
                updateStatus: jest.fn(),
            };
            const result = await decideMarkAttendanceUseCase(
                { bookingRepository: repo, now: () => now },
                { bookingId: BOOKING_ID, bizId: BIZ_ID, attended: false },
            );
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.newStatus).toBe('no_show');
                expect(result.applyPromotion).toBe(false);
                expect(result.currentStatus).toBe('hold');
            }
        });
    });
});
