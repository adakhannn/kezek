import appJson from '../../../app.json';
import { linking } from '../../navigation/linking';

describe('linking config', () => {
    test('maps nested cabinet profile route', () => {
        const config = linking.config?.screens as Record<string, any>;
        expect(config.Main.screens.Cabinet.screens.CabinetMain).toBe('cabinet');
        expect(config.Main.screens.Cabinet.screens.Profile).toBe('cabinet/profile');
    });

    test('web booking links open the booking, business links open the business (MOB-05)', () => {
        const config = linking.config?.screens as Record<string, any>;
        // The web serves one booking at /booking/<id> and a business at /b/<slug>.
        expect(config.BookingDetails.path).toBe('booking/:id');
        expect(config.BookingDetails.alias).toEqual(['booking-detail/:id']);
        expect(config.Booking.path).toBe('b/:slug');
        expect(config.BookingDetails.parse.id('7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f')).toBe('7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f');
        expect(linking.prefixes).toEqual(['kezek://', 'https://kezek.vercel.app']);
    });

    test('the verified Android App Link claims only the web paths the app opens itself (R25-16)', () => {
        const https = appJson.expo.android.intentFilters
            .flatMap((filter) => filter.data)
            .filter((data) => 'scheme' in data && data.scheme === 'https');
        expect(https).toEqual([
            { scheme: 'https', host: 'kezek.vercel.app', pathPrefix: '/b/' },
            { scheme: 'https', host: 'kezek.vercel.app', pathPrefix: '/booking/' },
        ]);
        // The web cabinet handoff, magic link and password reset stay in the browser.
        const config = linking.config?.screens as Record<string, any>;
        expect(config.Booking.path.startsWith('b/')).toBe(true);
        expect(config.BookingDetails.path.startsWith('booking/')).toBe(true);
    });
});
