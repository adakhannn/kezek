/**
 * ARCH-11: the booking flow shows slots and picks days in the business's own zone (businesses.tz).
 * Asia/Bishkek is UTC+6, Asia/Almaty UTC+5 and Europe/Moscow UTC+3.
 */
import { renderHook } from '@testing-library/react-native';
import { formatTimeSlot } from '@shared-client/formatters';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import { useBookingStep4Dates } from '../../screens/booking/useBookingStep4Dates';
import { formatDate, formatDateTime, formatTime } from '../../utils/format';

jest.mock('../../i18n', () => ({ useLanguage: () => ({ locale: 'ru' }) }));

describe('business time zone in mobile', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('formatters keep Asia/Bishkek by default and follow the business zone', () => {
        const start = '2026-11-25T18:30:00.000Z';
        expect(formatTime(start)).toBe('00:30');
        expect(formatTime(start, 'Asia/Almaty')).toBe('23:30');
        expect(formatTime(start, 'Europe/Moscow')).toBe('21:30');
        expect(formatTime(start, 'Not/AZone')).toBe('00:30');
        expect(formatDate(start, 'en')).toBe('November 26, 2026');
        expect(formatDate(start, 'en', 'Asia/Almaty')).toBe('November 25, 2026');
        expect(formatDateTime(start, true, 'en', 'Europe/Moscow')).toBe('November 25, 2026, 21:30');
    });

    test('slot labels use the business zone', () => {
        const slot = '2026-11-25T05:00:00.000Z';
        expect(formatTimeSlot(slot, resolveBusinessTimeZone(null))).toBe('11:00');
        expect(formatTimeSlot(slot, resolveBusinessTimeZone('Asia/Almaty'))).toBe('10:00');
    });

    test('the date list starts on the business today', () => {
        jest.useFakeTimers({ now: new Date('2026-11-25T18:30:00.000Z') });
        const bishkek = renderHook(() => useBookingStep4Dates(null)).result.current;
        const almaty = renderHook(() => useBookingStep4Dates('Asia/Almaty')).result.current;
        expect(bishkek.todayInTz).toBe('2026-11-26');
        expect(bishkek.dates[0]).toBe('2026-11-26');
        expect(almaty.todayInTz).toBe('2026-11-25');
        expect(almaty.dates[0]).toBe('2026-11-25');
        expect(almaty.dates).toHaveLength(30);
    });
});
