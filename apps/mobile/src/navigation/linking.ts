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
                    SignUp: 'auth/sign-up',
                    Verify: 'auth/verify',
                },
            },
            Main: {
                screens: {
                    Home: '',
                    Cabinet: 'cabinet',
                    Dashboard: 'dashboard',
                    Staff: 'staff',
                    Booking: {
                        path: 'booking/:slug',
                        parse: {
                            slug: (slug: string) => slug,
                        },
                    },
                    BookingDetails: {
                        path: 'booking/:id',
                        parse: {
                            id: (id: string) => id,
                        },
                    },
                    Profile: 'profile',
                },
            },
        },
    },
};

