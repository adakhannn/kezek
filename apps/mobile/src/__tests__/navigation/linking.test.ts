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
        // /b/<slug> is the business page (C2) and /b/<slug>/booking its booking flow, as on the web.
        expect(config.Business.path).toBe('b/:slug');
        expect(config.Booking.path).toBe('b/:slug/booking');
        expect(linking.config?.initialRouteName).toBe('Main');
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
        expect(config.Business.path.startsWith('b/')).toBe(true);
        expect(config.Booking.path.startsWith('b/')).toBe(true);
        expect(config.BookingDetails.path.startsWith('booking/')).toBe(true);
    });
});

describe('links resolve to the public screens (C1)', () => {
    const { getStateFromPath } = jest.requireActual('@react-navigation/native') as typeof import('@react-navigation/native');
    const routesOf = (path: string) => {
        const state = getStateFromPath(path, linking.config as never);
        return state?.routes.map((route) => ({ name: route.name, params: route.params }));
    };

    test('a business, its booking flow and a booking keep the home screen under them', () => {
        expect(routesOf('b/salon')).toEqual([
            { name: 'Main', params: undefined },
            { name: 'Business', params: { slug: 'salon' } },
        ]);
        expect(routesOf('b/salon/booking')?.[1]).toEqual({ name: 'Booking', params: { slug: 'salon' } });
        expect(routesOf('booking/abc')?.[1]).toEqual({ name: 'BookingDetails', params: { id: 'abc' } });
    });
});

describe('a tapped booking push opens the booking', () => {
    const Notifications = jest.requireMock('expo-notifications') as {
        getLastNotificationResponseAsync: jest.Mock; addNotificationResponseReceivedListener: jest.Mock;
    };
    const { Linking } = jest.requireActual('react-native') as typeof import('react-native');
    const BOOKING_ID = '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f';
    const tap = { notification: { request: { content: { data: { bookingId: BOOKING_ID, type: 'reminder_2h' } } } } };

    test('a link wins at a cold start; otherwise the notification that opened the app', async () => {
        const initial = jest.spyOn(Linking, 'getInitialURL').mockResolvedValueOnce('kezek://b/salon');
        await expect(linking.getInitialURL!()).resolves.toBe('kezek://b/salon');
        initial.mockResolvedValueOnce(null);
        Notifications.getLastNotificationResponseAsync.mockResolvedValueOnce(tap);
        await expect(linking.getInitialURL!()).resolves.toBe(`kezek://booking/${BOOKING_ID}`);
        initial.mockRestore();
    });

    test('a tap while the app runs reaches the navigation listener', () => {
        let onTap: (response: unknown) => void = () => undefined;
        const remove = jest.fn();
        Notifications.addNotificationResponseReceivedListener.mockImplementationOnce((callback: typeof onTap) => { onTap = callback; return { remove }; });
        const listener = jest.fn();
        const unsubscribe = linking.subscribe!(listener) as () => void;
        onTap(tap);
        expect(listener).toHaveBeenCalledWith(`kezek://booking/${BOOKING_ID}`);
        unsubscribe();
        expect(remove).toHaveBeenCalled();
    });
});
