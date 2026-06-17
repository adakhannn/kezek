import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from './types';

/**
 * Конфигурация глубоких ссылок для навигации
 */
export const linking: LinkingOptions<RootStackParamList> = {
    prefixes: ['kezek://', 'https://kezek.kg', 'https://www.kezek.kg'],
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
            Booking: {
                path: 'booking/:slug',
                parse: {
                    slug: (slug: string) => slug,
                },
            },
            BookingDetails: {
                path: 'booking-detail/:id',
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
