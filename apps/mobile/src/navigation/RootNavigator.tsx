import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

import { supabase } from '../lib/supabase';
import { RootStackParamList } from './types';
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
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
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
        <NavigationContainer>
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

