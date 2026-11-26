/**
 * Plural forms without Intl (i18n/plural.ts) and the counted texts of the three dictionaries.
 */
import { createTranslate, pluralForm, translatePlural, type MobileI18nKey, type PluralKey, type Translate } from '../../i18n';
import { en } from '../../i18n/dictionaries/en';
import { ky } from '../../i18n/dictionaries/ky';
import { ru } from '../../i18n/dictionaries/ru';

const FORMS = ['one', 'few', 'many'] as const;
const COUNTS = [0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 112, 122];

describe('plural forms', () => {
    test('Russian: one for 1, 21, 101; few for 2–4, 22, 122; many for 0, 5–20, 25, 111–114', () => {
        expect(COUNTS.map((count) => [count, pluralForm(count, 'ru')])).toEqual([
            [0, 'many'], [1, 'one'], [2, 'few'], [4, 'few'], [5, 'many'], [11, 'many'], [12, 'many'], [14, 'many'],
            [21, 'one'], [22, 'few'], [25, 'many'], [101, 'one'], [111, 'many'], [112, 'many'], [122, 'few'],
        ]);
    });

    test('English: one only for exactly 1, many otherwise', () => {
        expect(COUNTS.filter((count) => pluralForm(count, 'en') === 'one')).toEqual([1]);
        expect(new Set(COUNTS.filter((count) => count !== 1).map((count) => pluralForm(count, 'en')))).toEqual(new Set(['many']));
    });

    test('Kyrgyz: a noun does not change after a number, so one form for every count', () => {
        expect(new Set(COUNTS.map((count) => pluralForm(count, 'ky')))).toEqual(new Set(['one']));
    });

    test('every counted text has its three forms with {count}; ky repeats one text, en .few repeats .many', () => {
        const bases = [...new Set(
            Object.keys(ru).filter((key) => /\.(one|few|many)$/.test(key)).map((key) => key.replace(/\.(one|few|many)$/, '')),
        )].sort();
        expect(bases).toEqual([
            'booking.duration.minutesLong',
            'cabinet.signOut.pending.message',
            'discovery.home.promotions',
            'staff.shiftQuick.operationsQueued',
            'staff.shifts.clientsCount',
        ]);
        for (const base of bases) {
            const keys = FORMS.map((form) => `${base}.${form}` as MobileI18nKey);
            for (const dictionary of [ru, ky, en]) {
                for (const key of keys) expect([key, dictionary[key]]).toEqual([key, expect.stringContaining('{count}')]);
            }
            expect([base, new Set(keys.map((key) => ky[key])).size]).toEqual([base, 1]);
            expect(en[`${base}.few` as MobileI18nKey]).toBe(en[`${base}.many` as MobileI18nKey]);
        }
    });

    test('the counted staff and booking texts agree with the number in each language', () => {
        const [tRu, tKy, tEn] = (['ru', 'ky', 'en'] as const).map(createTranslate);
        const counted = (t: Translate, key: PluralKey, counts: number[]) => counts.map((count) => translatePlural(t, key, count));

        expect(counted(tRu, 'staff.shifts.clientsCount', [1, 3, 5, 21])).toEqual(['(1 клиент)', '(3 клиента)', '(5 клиентов)', '(21 клиент)']);
        expect(counted(tEn, 'staff.shifts.clientsCount', [1, 2, 21])).toEqual(['(1 client)', '(2 clients)', '(21 clients)']);
        expect(counted(tKy, 'staff.shifts.clientsCount', [1, 5])).toEqual(['(1 кардар)', '(5 кардар)']);

        expect(counted(tRu, 'staff.shiftQuick.operationsQueued', [1, 2, 5])).toEqual([
            '1 операция в очереди',
            '2 операции в очереди',
            '5 операций в очереди',
        ]);
        expect(counted(tEn, 'staff.shiftQuick.operationsQueued', [1, 4])).toEqual(['1 operation in the queue', '4 operations in the queue']);
        expect(counted(tKy, 'staff.shiftQuick.operationsQueued', [3])).toEqual(['Кезекте 3 операция']);

        expect(counted(tRu, 'booking.duration.minutesLong', [1, 3, 30])).toEqual(['1 минута', '3 минуты', '30 минут']);
        expect(counted(tEn, 'booking.duration.minutesLong', [1, 45])).toEqual(['1 minute', '45 minutes']);
        expect(counted(tKy, 'booking.duration.minutesLong', [45])).toEqual(['45 мүнөт']);
    });
});
