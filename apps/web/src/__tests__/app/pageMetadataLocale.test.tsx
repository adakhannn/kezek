import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { generateMetadata as bookingMetadata } from '@/app/booking/[id]/page';
import { rootMetadata } from '@/app/rootMetadata';

const mockLocale = { value: null as 'ru' | 'ky' | 'en' | null };
jest.mock('@/lib/cookies', () => ({ getLocaleFromCookieServer: async () => mockLocale.value }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));

describe('localized page titles (M3)', () => {
    test.each([
        ['ru', ru],
        ['ky', ky],
        ['en', en],
    ] as const)('the default title and description follow the %s locale', (locale, dictionary) => {
        const metadata = rootMetadata(locale);
        expect(metadata.title).toBe(dictionary['home.seo.title']);
        expect(metadata.description).toBe(dictionary['home.seo.description']);
        expect(metadata.manifest).toBe('/manifest.webmanifest');
    });

    test('no English default on a Russian page', () => {
        expect(String(rootMetadata('ru').title)).toBe('Kezek — онлайн-запись на услуги в Кыргызстане');
    });

    test.each([
        [null, 'Запись — Kezek'],
        ['ru', 'Запись — Kezek'],
        ['ky', 'Жазылыш — Kezek'],
        ['en', 'Booking — Kezek'],
    ] as const)('the booking details page is titled in the cookie locale %s', async (locale, title) => {
        mockLocale.value = locale;
        await expect(bookingMetadata()).resolves.toEqual({ title });
    });
});
