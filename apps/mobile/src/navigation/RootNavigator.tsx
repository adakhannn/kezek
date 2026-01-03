import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';

import { supabase } from '../lib/supabase';
import { RootStackParamList } from './types';
import { linking } from './linking';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import BookingDetailsScreen from '../screens/BookingDetailsScreen';
import BookingScreen from '../screens/BookingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Проверяем текущую сессию
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Подписываемся на изменения авторизации
        const {
            data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        // Обрабатываем deep links с токенами авторизации
        const handleDeepLink = async (url: string) => {
            if (!url) return;

            console.log('[RootNavigator] Handling deep link:', url);

            try {
                // Проверяем, является ли это callback URL
                if (url.includes('auth/callback') || url.includes('#access_token=') || url.includes('?code=')) {
                    // Извлекаем токены из URL
                    let urlObj: URL;
                    try {
                        urlObj = new URL(url);
                    } catch (e) {
                        // Если URL не валидный, пытаемся обработать как deep link
                        console.log('[RootNavigator] Invalid URL format, trying to parse manually');
                        const hashMatch = url.match(/#access_token=([^&]+)&refresh_token=([^&]+)/);
                        if (hashMatch) {
                            const accessToken = decodeURIComponent(hashMatch[1]);
                            const refreshToken = decodeURIComponent(hashMatch[2]);
                            console.log('[RootNavigator] Found tokens in hash, setting session');
                            const { error } = await supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken,
                            });
                            if (error) {
                                console.error('[RootNavigator] Error setting session:', error);
                            } else {
                                console.log('[RootNavigator] Session set successfully');
                            }
                            return;
                        }
                        throw e;
                    }

                    const hashParams = new URLSearchParams(urlObj.hash.substring(1));
                    const queryParams = new URLSearchParams(urlObj.search);

                    const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
                    const code = queryParams.get('code');

                    console.log('[RootNavigator] Extracted from URL:', { 
                        hasAccessToken: !!accessToken, 
                        hasRefreshToken: !!refreshToken, 
                        hasCode: !!code 
                    });

                    if (accessToken && refreshToken) {
                        // Устанавливаем сессию из токенов
                        console.log('[RootNavigator] Setting session from tokens');
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (error) {
                            console.error('[RootNavigator] Error setting session:', error);
                        } else {
                            console.log('[RootNavigator] Session set successfully');
                        }
                    } else if (code) {
                        // Обмениваем code на сессию (для OAuth)
                        console.log('[RootNavigator] Exchanging code for session');
                        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                        if (error) {
                            console.error('[RootNavigator] Error exchanging code:', error);
                        } else {
                            console.log('[RootNavigator] Code exchanged successfully, session created');
                        }
                    } else {
                        console.warn('[RootNavigator] No tokens or code found in URL');
                    }
                }
            } catch (error) {
                console.error('[RootNavigator] Error handling deep link:', error);
            }
        };

        // Проверяем initial URL при запуске
        Linking.getInitialURL().then((url) => {
            if (url) {
                handleDeepLink(url);
            }
        });

        // Слушаем входящие ссылки во время работы приложения
        const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
            handleDeepLink(url);
        });

        return () => {
            authSubscription.unsubscribe();
            linkingSubscription.remove();
        };
    }, []);

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer linking={linking}>
            <Stack.Navigator screenOptions={{ headerShown: true }}>
                {session ? (
                    <>
                        <Stack.Screen
                            name="Main"
                            component={MainNavigator}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="BookingDetails"
                            component={BookingDetailsScreen}
                            options={{ title: 'Детали записи' }}
                        />
                        <Stack.Screen
                            name="Booking"
                            component={BookingScreen}
                            options={{ title: 'Запись' }}
                        />
                    </>
                ) : (
                    <Stack.Screen
                        name="Auth"
                        component={AuthNavigator}
                        options={{ headerShown: false }}
                    />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6b7280',
    },
});

