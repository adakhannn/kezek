import { LinkingOptions } from '@react-navigation/native';
import { Linking } from 'react-native';
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
                    WhatsApp: 'auth/whatsapp',
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
            // Обработка callback URL для OAuth
            // Это позволит обрабатывать https://kezek.kg/auth/callback-mobile как deep link
        },
    },
    // Обработка deep links с токенами авторизации
    async getInitialURL() {
        // Проверяем, есть ли deep link при запуске приложения
        const url = await Linking.getInitialURL();
        return url || undefined;
    },
    subscribe(listener) {
        // Обрабатываем deep links во время работы приложения
        const onReceiveURL = ({ url }: { url: string }) => {
            listener(url);
        };

        // Слушаем входящие ссылки
        const subscription = Linking.addEventListener('url', onReceiveURL);

        return () => {
            subscription.remove();
        };
    },
};

