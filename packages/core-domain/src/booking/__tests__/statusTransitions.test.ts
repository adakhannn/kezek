/**
 * Табличные тесты для матрицы переходов статусов и хелперов.
 */

import type { BookingStatus } from '../types';
import {
    isTerminalStatus,
    canCancel,
    canConfirm,
    canMarkAttendance,
    canChangeStatus,
} from '../statusTransitions';

const ALL_STATUSES: BookingStatus[] = ['hold', 'confirmed', 'paid', 'no_show', 'cancelled'];

describe('statusTransitions', () => {
    describe('isTerminalStatus', () => {
        it.each([
            ['paid', true],
            ['no_show', true],
            ['cancelled', true],
            ['hold', false],
            ['confirmed', false],
        ] as const)('returns %s for status %s', (status, expected) => {
            expect(isTerminalStatus(status)).toBe(expected);
        });
    });

    describe('canCancel', () => {
        it.each([
            ['hold', true],
            ['confirmed', true],
            ['paid', false],
            ['no_show', false],
            ['cancelled', false],
        ] as const)('returns %s for status %s', (status, expected) => {
            expect(canCancel(status)).toBe(expected);
        });
    });

    describe('canConfirm', () => {
        it.each([
            ['hold', true],
            ['confirmed', false],
            ['paid', false],
            ['no_show', false],
            ['cancelled', false],
        ] as const)('returns %s for status %s', (status, expected) => {
            expect(canConfirm(status)).toBe(expected);
        });
    });

    describe('canMarkAttendance', () => {
        const past = new Date('2024-01-01T10:00:00Z');
        const future = new Date('2025-12-31T18:00:00Z');
        const now = new Date('2024-06-01T12:00:00Z');

        it('returns true for hold when booking is in the past', () => {
            expect(canMarkAttendance('hold', { bookingStartAt: past, now })).toBe(true);
        });
        it('returns true for confirmed when booking is in the past', () => {
            expect(canMarkAttendance('confirmed', { bookingStartAt: past, now })).toBe(true);
        });
        it('returns false for hold when booking is in the future', () => {
            expect(canMarkAttendance('hold', { bookingStartAt: future, now })).toBe(false);
        });
        it('returns false for paid (terminal)', () => {
            expect(canMarkAttendance('paid', { bookingStartAt: past, now })).toBe(false);
        });
        it('returns false for no_show (terminal)', () => {
            expect(canMarkAttendance('no_show', { bookingStartAt: past, now })).toBe(false);
        });
        it('returns false for cancelled (terminal)', () => {
            expect(canMarkAttendance('cancelled', { bookingStartAt: past, now })).toBe(false);
        });
        it('accepts ISO string for bookingStartAt', () => {
            expect(canMarkAttendance('hold', { bookingStartAt: past.toISOString(), now })).toBe(true);
        });
    });

    describe('canChangeStatus — матрица переходов', () => {
        const past = new Date('2024-01-01T10:00:00Z');
        const future = new Date('2025-12-31T18:00:00Z');
        const now = new Date('2024-06-01T12:00:00Z');

        /** Допустимые переходы без учёта времени (confirmed, cancelled) */
        const allowedWithoutTime: Array<{ from: BookingStatus; to: BookingStatus }> = [
            { from: 'hold', to: 'confirmed' },
            { from: 'hold', to: 'cancelled' },
            { from: 'confirmed', to: 'cancelled' },
        ];

        it.each(allowedWithoutTime)('allows $from -> $to', ({ from, to }) => {
            expect(canChangeStatus(from, to)).toBe(true);
            expect(canChangeStatus(from, to, { bookingStartAt: past, now })).toBe(true);
        });

        /** Переходы в paid/no_show допустимы только из confirmed и требуют бронь в прошлом */
        const toPaidNoShow: Array<{ from: BookingStatus; to: BookingStatus }> = [
            { from: 'confirmed', to: 'paid' },
            { from: 'confirmed', to: 'no_show' },
        ];

        it.each(toPaidNoShow)('allows $from -> $to when booking is in the past', ({ from, to }) => {
            expect(canChangeStatus(from, to, { bookingStartAt: past, now })).toBe(true);
        });

        it.each(toPaidNoShow)('disallows $from -> $to when booking is in the future', ({ from, to }) => {
            expect(canChangeStatus(from, to, { bookingStartAt: future, now })).toBe(false);
        });

        it.each(toPaidNoShow)('disallows $from -> $to when bookingStartAt is missing', ({ from, to }) => {
            expect(canChangeStatus(from, to)).toBe(false);
            expect(canChangeStatus(from, to, { now })).toBe(false);
        });

        /** Недопустимые переходы: из конечных статусов и не из матрицы */
        const disallowed: Array<{ from: BookingStatus; to: BookingStatus }> = [
            { from: 'paid', to: 'cancelled' },
            { from: 'paid', to: 'hold' },
            { from: 'no_show', to: 'confirmed' },
            { from: 'cancelled', to: 'hold' },
            { from: 'hold', to: 'hold' },
            { from: 'hold', to: 'paid' }, // hold->paid не в ALLOWED_TRANSITIONS (только confirmed->paid/no_show)
            { from: 'confirmed', to: 'hold' },
            { from: 'confirmed', to: 'confirmed' },
        ];

        it.each(disallowed)('disallows $from -> $to', ({ from, to }) => {
            expect(canChangeStatus(from, to)).toBe(false);
            expect(canChangeStatus(from, to, { bookingStartAt: past, now })).toBe(false);
        });

        /** Полная матрица: для каждого from перебираем все to */
        it('covers full transition matrix consistently', () => {
            const matrix: Record<BookingStatus, BookingStatus[]> = {
                hold: ['confirmed', 'cancelled'],
                confirmed: ['cancelled', 'paid', 'no_show'],
                paid: [],
                no_show: [],
                cancelled: [],
            };
            for (const from of ALL_STATUSES) {
                for (const to of ALL_STATUSES) {
                    const allowed = matrix[from].includes(to);
                    const needsPast = (to === 'paid' || to === 'no_show') && allowed;
                    const result = canChangeStatus(
                        from,
                        to,
                        needsPast ? { bookingStartAt: past, now } : undefined,
                    );
                    expect(result).toBe(allowed && (!needsPast || past.getTime() <= now.getTime()));
                }
            }
        });
    });
});
