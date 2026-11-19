import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from './types';

/**
 * Конфигурация глубоких ссылок для навигации
 */
export const linking: LinkingOptions<RootStackParamList> = {
    prefixes: ['kezek://', 'https://kezek.vercel.app'],
    config: {
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
            // The same paths as the web app (MOB-05): /b/<slug> is a business's booking page and
            // /booking/<id> is one booking, the link that notifications and the cabinet share.
            Booking: {
                path: 'b/:slug',
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
            ShiftQuick: 'staff/shift-quick',
            Shifts: 'staff/shifts',
            // OAuth callback URL handling (e.g. /auth/callback-mobile) is performed
            // by useRootNavigationSession.handleDeepLinkAuth as a side-effect flow,
            // not by direct screen route mapping.
        },
    },
};
