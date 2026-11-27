/**
 * The shared formatters of utils/format: one per kind of value (date, calendar date, number, price),
 * in the app language, the same text on every device.
 */
import { dayLabel } from '../../screens/manage/opsKit/format';
import { formatMoney, formatNumber as opsFormatNumber } from '../../screens/manage/opsKit/money';
import { formatAmount } from '../../screens/manageStaff/financeView';
import { staffServicePriceKey } from '../../screens/staff/useStaffServices';
import { createTranslate } from '../../i18n/translate';
import { formatDate, formatDateTime, formatNumber, formatPrice, formatYmd } from '../../utils/format';

const NBSP = ' ';

describe('utils/format', () => {
    test('a Russian date has no leading zero on the day and a genitive month', () => {
        expect(formatDate('2026-12-05T06:00:00.000Z', 'ru')).toBe('5 декабря 2026');
        expect(formatDateTime('2026-12-05T06:00:00.000Z', true, 'ru')).toBe('5 декабря 2026, 12:00');
        expect(formatDate('2026-11-30T06:00:00.000Z', 'ru')).toBe('30 ноября 2026');
    });

    test('a calendar date (YYYY-MM-DD) keeps its day whatever the time zone', () => {
        expect(formatYmd('2026-12-05', 'ru')).toBe('5 декабря 2026');
        expect(formatYmd('2026-12-05', 'en')).toBe('December 5, 2026');
        expect(formatYmd('2026-12-31', 'ru')).toBe('31 декабря 2026');
        expect(formatYmd('not a date', 'ru')).toBe('not a date');
        // The management screens' dayLabel is the same formatter.
        expect(dayLabel('2026-12-05', 'ru')).toBe(formatYmd('2026-12-05', 'ru'));
    });

    test('numbers are grouped the same way on every device, with the language decimal mark', () => {
        expect(formatNumber(1500, 'ru')).toBe(`1${NBSP}500`);
        expect(formatNumber(1500, 'ky')).toBe(`1${NBSP}500`);
        expect(formatNumber(1500, 'en')).toBe('1,500');
        expect(formatNumber(7.5, 'ru', 1)).toBe('7,5');
        expect(formatNumber(7.5, 'en', 1)).toBe('7.5');
        expect(formatNumber(60, 'ru', 1)).toBe('60');
        expect(formatNumber(Number.NaN, 'ru')).toBe('0');
        // opsKit and the finance view reuse it rather than their own toLocaleString.
        expect(opsFormatNumber).toBe(formatNumber);
        expect(formatAmount(12345, 'ru')).toBe(`12${NBSP}345`);
    });

    test('money always carries "сом" (som in English)', () => {
        expect(formatPrice(1500, 'ru')).toBe(`1${NBSP}500 сом`);
        expect(formatPrice(1500, 'en')).toBe('1,500 som');
        expect(formatPrice(null, 'ru')).toBe('');
        expect(formatMoney(2500, createTranslate('ru'))).toBe(`2${NBSP}500 сом`);
    });

    test("a master's service price range is grouped and joined with an en dash", () => {
        const range = staffServicePriceKey({ price_from: 1500, price_to: 2000 }, 'ru');
        expect(range).toEqual({ key: 'parity.staffServices.priceBetween', params: { from: `1${NBSP}500`, to: `2${NBSP}000` } });
        expect(createTranslate('ru')('parity.staffServices.priceBetween', range!.params)).toBe(`1${NBSP}500–2${NBSP}000 сом`);
    });
});
