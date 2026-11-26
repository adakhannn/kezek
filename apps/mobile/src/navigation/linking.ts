import { LinkingOptions } from '@react-navigation/native';
import { Linking } from 'react-native';

import { initialNotificationUrl, subscribeToNotificationTaps } from '../lib/pushNotifications';
import { RootStackParamList } from './types';

/**
 * Конфигурация глубоких ссылок для навигации
 */
export const linking: LinkingOptions<RootStackParamList> = {
    prefixes: ['kezek://', 'https://kezek.vercel.app'],
    // A tapped booking push ({ bookingId }) opens kezek://booking/<id>, like a link.
    async getInitialURL() {
        return (await Linking.getInitialURL()) ?? (await initialNotificationUrl());
    },
    subscribe(listener) {
        const links = Linking.addEventListener('url', ({ url }) => listener(url));
        const unsubscribeTaps = subscribeToNotificationTaps(listener);
        return () => {
            links.remove();
            unsubscribeTaps();
        };
    },
    config: {
        // A link opened at a cold start keeps the home screen under it, so Back stays in the app.
        initialRouteName: 'Main',
        screens: {
            Auth: {
                screens: {
                    SignIn: 'auth/sign-in',
                    Verify: 'auth/verify',
                    WhatsApp: 'auth/whatsapp',
                },
            },
            Main: {
                screens: {
                    Home: '',
                    Cabinet: {
                        screens: {
                            CabinetMain: 'cabinet',
                            Profile: 'cabinet/profile',
                        },
                    },
                    Dashboard: 'dashboard',
                    Staff: 'staff',
                },
            },
            Map: 'map',
            // The same paths as the web app (MOB-05): /b/<slug> is a business's page, /b/<slug>/booking
            // its booking flow and /booking/<id> one booking, the link that notifications and the
            // cabinet share. The first two open signed out too (C1); a booking asks for the sign-in
            // on its own screen and shows the booking after it.
            Business: {
                path: 'b/:slug',
                parse: {
                    slug: (slug: string) => slug,
                },
            },
            Booking: {
                path: 'b/:slug/booking',
                parse: {
                    slug: (slug: string) => slug,
                },
            },
            BookingDetails: {
                path: 'booking/:id',
                // Links the app produced before MOB-05.
                alias: ['booking-detail/:id'],
                parse: {
                    id: (id: string) => id,
                },
            },
            Promotions: {
                path: 'b/:slug/promotions',
                parse: {
                    slug: (slug: string) => slug,
                },
            },
            BusinessApply: 'business/apply',
            RoleApply: 'business/role-apply',
            ShiftQuick: 'staff/shift-quick',
            Shifts: 'staff/shifts',
            StaffSchedule: 'staff/schedule',
            // OAuth callback URL handling (e.g. /auth/callback-mobile) is performed
            // by useRootNavigationSession.handleDeepLinkAuth as a side-effect flow,
            // not by direct screen route mapping.
        },
    },
};
