import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking, AppState, AppStateStatus } from 'react-native';

import { supabase } from '../lib/supabase';
import { RootStackParamList } from './types';
import { linking } from './linking';
import { colors } from '../constants/colors';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { logError, logDebug, logWarn } from '../lib/log';
import BookingDetailsScreen from '../screens/BookingDetailsScreen';
import BookingScreen from '../screens/BookingScreen';
import BookingStep1Branch from '../screens/booking/BookingStep1Branch';
import BookingStep2Service from '../screens/booking/BookingStep2Service';
import BookingStep3Staff from '../screens/booking/BookingStep3Staff';
import BookingStep4Date from '../screens/booking/BookingStep4Date';
import BookingStep5Time from '../screens/booking/BookingStep5Time';
import BookingStep6Confirm from '../screens/booking/BookingStep6Confirm';
import BookingCancelButton from '../components/BookingCancelButton';
import { BookingProvider } from '../contexts/BookingContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const [session, setSession] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Проверяем текущую сессию
        supabase.auth.getSession().then(({ data: { session } }) => {
            logDebug('RootNavigator', 'Initial session check', { hasSession: !!session });
            setSession(session);
            setLoading(false);
        });

        // Подписываемся на изменения авторизации
        const {
            data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            logDebug('RootNavigator', 'Auth state changed', { event, hasSession: !!session });
            setSession(session);
            
            // Если пользователь авторизовался, обновляем состояние
            if (event === 'SIGNED_IN' && session) {
                logDebug('RootNavigator', 'User signed in, updating UI');
            }
        });

        // Обрабатываем deep links с токенами авторизации
        const handleDeepLink = async (url: string) => {
            if (!url) return;

            logDebug('RootNavigator', 'Handling deep link', { url });

            try {
                logDebug('RootNavigator', 'Processing URL', { url });
                
                // Проверяем, является ли это callback URL (поддерживаем и https:// и kezek://)
                const isCallbackUrl = 
                    url.includes('auth/callback') || 
                    url.includes('callback-mobile') ||
                    url.includes('#access_token=') || 
                    url.includes('?code=') ||
                    url.includes('access_token=') ||
                    url.includes('refresh_token=');
                
                if (isCallbackUrl) {
                    logDebug('RootNavigator', 'Detected callback URL');
                    // Извлекаем токены из URL
                    let urlObj: URL;
                    try {
                        urlObj = new URL(url);
                    } catch (e) {
                        // Если URL не валидный, пытаемся обработать как deep link
                        logDebug('RootNavigator', 'Invalid URL format, trying to parse manually');
                        const hashMatch = url.match(/#access_token=([^&]+)&refresh_token=([^&]+)/);
                        if (hashMatch) {
                            const accessToken = decodeURIComponent(hashMatch[1]);
                            const refreshToken = decodeURIComponent(hashMatch[2]);
                            logDebug('RootNavigator', 'Found tokens in hash, setting session');
                            const { error } = await supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken,
                            });
                            if (error) {
                                logError('RootNavigator', 'Error setting session', error);
                            } else {
                                logDebug('RootNavigator', 'Session set successfully');
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
                    const exchangeCode = queryParams.get('exchange_code'); // Код для обмена через API

                    logDebug('RootNavigator', 'Extracted from URL', { 
                        hasAccessToken: !!accessToken, 
                        hasRefreshToken: !!refreshToken, 
                        hasCode: !!code,
                        hasExchangeCode: !!exchangeCode
                    });

                    // Приоритет 1: Обмен кода через API (самый безопасный способ)
                    if (exchangeCode) {
                        logDebug('RootNavigator', 'Exchanging code via API', { exchangeCode });
                        try {
                            // Используем тот же способ получения API_URL, что и в api.ts
                            const Constants = require('expo-constants').default;
                            const apiUrl = 
                                process.env.EXPO_PUBLIC_API_URL || 
                                Constants.expoConfig?.extra?.apiUrl ||
                                Constants.manifest?.extra?.apiUrl ||
                                'https://kezek.kg';
                            
                            logDebug('RootNavigator', 'API URL', { apiUrl });
                            const response = await fetch(`${apiUrl}/api/auth/mobile-exchange?code=${encodeURIComponent(exchangeCode)}`);
                            
                            if (response.ok) {
                                const { accessToken: apiAccessToken, refreshToken: apiRefreshToken } = await response.json();
                                logDebug('RootNavigator', 'Tokens received from API, setting session');
                                const { error } = await supabase.auth.setSession({
                                    access_token: apiAccessToken,
                                    refresh_token: apiRefreshToken,
                                });
                                if (error) {
                                    logError('RootNavigator', 'Error setting session from API', error);
                                } else {
                                    logDebug('RootNavigator', 'Session set successfully from API');
                                }
                            } else {
                                const errorText = await response.text();
                                logError('RootNavigator', 'API exchange failed', { status: response.status, errorText });
                            }
                        } catch (error) {
                            logError('RootNavigator', 'Error exchanging code via API', error);
                        }
                    } else if (accessToken && refreshToken) {
                        // Приоритет 2: Прямые токены из URL
                        logDebug('RootNavigator', 'Setting session from tokens');
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (error) {
                            logError('RootNavigator', 'Error setting session', error);
                        } else {
                            logDebug('RootNavigator', 'Session set successfully');
                        }
                    } else if (code) {
                        // Приоритет 3: OAuth code от Supabase
                        logDebug('RootNavigator', 'Exchanging code for session');
                        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                        if (error) {
                            logError('RootNavigator', 'Error exchanging code', error);
                        } else {
                            logDebug('RootNavigator', 'Code exchanged successfully, session created');
                        }
                    } else {
                        logWarn('RootNavigator', 'No tokens or code found in URL');
                    }
                }
            } catch (error) {
                logError('RootNavigator', 'Error handling deep link', error);
            }
        };

        // Проверяем initial URL при запуске
        Linking.getInitialURL().then((url) => {
            if (url) {
                logDebug('RootNavigator', 'Initial URL', { url });
                handleDeepLink(url);
            } else {
                logDebug('RootNavigator', 'No initial URL');
            }
        });

        // Слушаем входящие ссылки во время работы приложения
        const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
            logDebug('RootNavigator', 'URL event received', { url });
            handleDeepLink(url);
        });
        
        // Также слушаем изменения сессии от Supabase (на случай, если сессия установилась другим способом)
        const { data: { subscription: sessionSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
            logDebug('RootNavigator', 'Auth state changed', { event, hasSession: !!session });
            if (event === 'SIGNED_IN' && session) {
                logDebug('RootNavigator', 'User signed in', { userId: session.user.id });
                setSession(session);
            } else if (event === 'SIGNED_OUT') {
                logDebug('RootNavigator', 'User signed out');
                setSession(null);
            }
        });

        // Слушаем изменения состояния приложения (когда приложение возвращается из фона)
        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                logDebug('RootNavigator', 'App became active, checking session');
                
                // Сначала проверяем текущую сессию
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (currentSession && !session) {
                    logDebug('RootNavigator', 'Session found after app became active');
                    setSession(currentSession);
                    return;
                }
                
                // Если сессии нет, проверяем, есть ли pending токены через API
                // Это может помочь, если deep link не сработал, но пользователь авторизовался на веб-сайте
                if (!currentSession) {
                    logDebug('RootNavigator', 'No session, checking for pending tokens');
                    try {
                        const Constants = require('expo-constants').default;
                        const apiUrl = 
                            process.env.EXPO_PUBLIC_API_URL || 
                            Constants.expoConfig?.extra?.apiUrl ||
                            Constants.manifest?.extra?.apiUrl ||
                            'https://kezek.kg';
                        
                        const checkResponse = await fetch(`${apiUrl}/api/auth/mobile-exchange?check=true`);
                        if (checkResponse.ok) {
                            const checkData = await checkResponse.json();
                            if (checkData.hasPending && checkData.code) {
                                logDebug('RootNavigator', 'Found pending tokens, exchanging code', { code: checkData.code });
                                
                                // Обмениваем код на токены
                                const exchangeResponse = await fetch(`${apiUrl}/api/auth/mobile-exchange?code=${encodeURIComponent(checkData.code)}`);
                                if (exchangeResponse.ok) {
                                    const { accessToken, refreshToken } = await exchangeResponse.json();
                                    const { error } = await supabase.auth.setSession({
                                        access_token: accessToken,
                                        refresh_token: refreshToken,
                                    });
                                    if (!error) {
                                        logDebug('RootNavigator', 'Session set from pending tokens');
                                        const { data: { session: newSession } } = await supabase.auth.getSession();
                                        if (newSession) {
                                            setSession(newSession);
                                        }
                                    } else {
                                        logError('RootNavigator', 'Error setting session from pending tokens', error);
                                    }
                                }
                            } else {
                                logDebug('RootNavigator', 'No pending tokens found');
                            }
                        }
                    } catch (error) {
                        logError('RootNavigator', 'Error checking pending tokens', error);
                    }
                } else if (!currentSession && session) {
                    logDebug('RootNavigator', 'Session lost after app became active');
                    setSession(null);
                }
            }
        };

        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            authSubscription.unsubscribe();
            sessionSubscription.unsubscribe();
            linkingSubscription.remove();
            appStateSubscription.remove();
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
            <BookingProvider>
                <NavigationContainer linking={linking}>
                    <Stack.Navigator 
                        screenOptions={{ 
                            headerShown: true,
                            headerStyle: {
                                backgroundColor: colors.background.secondary,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border.dark,
                            },
                            headerTintColor: colors.text.primary,
                            headerTitleStyle: {
                                fontWeight: '600',
                                fontSize: 18,
                                color: colors.text.primary,
                            },
                        }}
                    >
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
                                    options={{ title: 'Запись', headerShown: false }}
                                />
                                <Stack.Screen
                                    name="BookingStep1Branch"
                                    component={BookingStep1Branch}
                                    options={{ 
                                        title: 'Выбор филиала', 
                                        headerBackTitle: 'Назад',
                                        headerRight: () => <BookingCancelButton />,
                                    }}
                                />
                                <Stack.Screen
                                    name="BookingStep2Service"
                                    component={BookingStep2Service}
                                    options={{ 
                                        title: 'Выбор услуги', 
                                        headerBackTitle: 'Назад',
                                        headerRight: () => <BookingCancelButton />,
                                    }}
                                />
                                <Stack.Screen
                                    name="BookingStep3Staff"
                                    component={BookingStep3Staff}
                                    options={{ 
                                        title: 'Выбор мастера', 
                                        headerBackTitle: 'Назад',
                                        headerRight: () => <BookingCancelButton />,
                                    }}
                                />
                                <Stack.Screen
                                    name="BookingStep4Date"
                                    component={BookingStep4Date}
                                    options={{ 
                                        title: 'Выбор даты', 
                                        headerBackTitle: 'Назад',
                                        headerRight: () => <BookingCancelButton />,
                                    }}
                                />
                                <Stack.Screen
                                    name="BookingStep5Time"
                                    component={BookingStep5Time}
                                    options={{ 
                                        title: 'Выбор времени', 
                                        headerBackTitle: 'Назад',
                                        headerRight: () => <BookingCancelButton />,
                                    }}
                                />
                                <Stack.Screen
                                    name="BookingStep6Confirm"
                                    component={BookingStep6Confirm}
                                    options={{ 
                                        title: 'Подтверждение', 
                                        headerBackTitle: 'Назад',
                                        headerRight: () => <BookingCancelButton />,
                                    }}
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
            </BookingProvider>
        );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.primary,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6b7280',
    },
});

