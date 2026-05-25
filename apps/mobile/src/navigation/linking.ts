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
                    Cabinet: 'cabinet',
                    Dashboard: 'dashboard',
                    Staff: 'staff',
                },
            },
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
            // Обработка callback URL для OAuth
            // Это позволит обрабатывать https://kezek.kg/auth/callback-mobile как deep link
        },
    },
};
