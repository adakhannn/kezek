import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import BookingCancelButton from '../components/BookingCancelButton';
import { colors } from '../constants/colors';
import { BookingProvider } from '../contexts/BookingContext';
import BookingDetailsScreen from '../screens/BookingDetailsScreen';
import BookingScreen from '../screens/BookingScreen';
import ShiftQuickScreen from '../screens/ShiftQuickScreen';
import ShiftsScreen from '../screens/ShiftsScreen';
import BookingStep1Branch from '../screens/booking/BookingStep1Branch';
import BookingStep2Service from '../screens/booking/BookingStep2Service';
import BookingStep3Staff from '../screens/booking/BookingStep3Staff';
import BookingStep4Date from '../screens/booking/BookingStep4Date';
import BookingStep5Time from '../screens/booking/BookingStep5Time';
import BookingStep6Confirm from '../screens/booking/BookingStep6Confirm';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { linking } from './linking';
import { RootStackParamList } from './types';
import { useRootAuthSession } from './useRootAuthSession';

const Stack = createNativeStackNavigator<RootStackParamList>();

const sharedStepOptions = {
    headerBackTitle: 'Назад',
    headerRight: () => <BookingCancelButton />,
};

const defaultScreenOptions = {
    headerShown: true,
    headerStyle: {
        backgroundColor: colors.background.secondary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.dark,
    },
    headerTintColor: colors.text.primary,
    headerTitleStyle: {
        fontWeight: '600' as const,
        fontSize: 18,
        color: colors.text.primary,
    },
};

function LoadingScreen() {
    return (
        <View style={styles.loading}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
    );
}

function AuthenticatedScreens() {
    return (
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
                options={{ title: 'Выбор филиала', ...sharedStepOptions }}
            />
            <Stack.Screen
                name="BookingStep2Service"
                component={BookingStep2Service}
                options={{ title: 'Выбор услуги', ...sharedStepOptions }}
            />
            <Stack.Screen
                name="BookingStep3Staff"
                component={BookingStep3Staff}
                options={{ title: 'Выбор мастера', ...sharedStepOptions }}
            />
            <Stack.Screen
                name="BookingStep4Date"
                component={BookingStep4Date}
                options={{ title: 'Выбор даты', ...sharedStepOptions }}
            />
            <Stack.Screen
                name="BookingStep5Time"
                component={BookingStep5Time}
                options={{ title: 'Выбор времени', ...sharedStepOptions }}
            />
            <Stack.Screen
                name="BookingStep6Confirm"
                component={BookingStep6Confirm}
                options={{ title: 'Подтверждение', ...sharedStepOptions }}
            />
            <Stack.Screen
                name="Shifts"
                component={ShiftsScreen}
                options={{ title: 'Смены и статистика', headerBackTitle: 'Назад' }}
            />
            <Stack.Screen
                name="ShiftQuick"
                component={ShiftQuickScreen}
                options={{ title: 'Моя смена', headerBackTitle: 'Назад' }}
            />
        </>
    );
}

export default function RootNavigator() {
    const { loading, session } = useRootAuthSession();

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <BookingProvider>
            <NavigationContainer linking={linking}>
                <Stack.Navigator screenOptions={defaultScreenOptions}>
                    {session ? (
                        <AuthenticatedScreens />
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
