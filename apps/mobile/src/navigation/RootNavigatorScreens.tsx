import React from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { colors } from '../constants/colors';
import BookingCancelButton from '../components/BookingCancelButton';
import BookingDetailsScreen from '../screens/BookingDetailsScreen';
import BookingScreen from '../screens/BookingScreen';
import BookingStep1Branch from '../screens/booking/BookingStep1Branch';
import BookingStep2Service from '../screens/booking/BookingStep2Service';
import BookingStep3Staff from '../screens/booking/BookingStep3Staff';
import BookingStep4Date from '../screens/booking/BookingStep4Date';
import BookingStep5Time from '../screens/booking/BookingStep5Time';
import BookingStep6Confirm from '../screens/booking/BookingStep6Confirm';
import ShiftsScreen from '../screens/ShiftsScreen';
import ShiftQuickScreen from '../screens/ShiftQuickScreen';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

export const rootStackScreenOptions: NativeStackNavigationOptions = {
    headerShown: true,
    headerStyle: {
        backgroundColor: colors.background.secondary,
    },
    headerShadowVisible: false,
    headerTintColor: colors.text.primary,
    headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
        color: colors.text.primary,
    },
};

const bookingStepOptions = (title: string): NativeStackNavigationOptions => ({
    title,
    headerBackTitle: 'Назад',
    headerRight: () => <BookingCancelButton />,
});

export function AuthStackScreen(Stack: any) {
    return (
        <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ headerShown: false }}
        />
    );
}

export function SignedInStackScreens(Stack: any) {
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
                options={bookingStepOptions('Выбор филиала')}
            />
            <Stack.Screen
                name="BookingStep2Service"
                component={BookingStep2Service}
                options={bookingStepOptions('Выбор услуги')}
            />
            <Stack.Screen
                name="BookingStep3Staff"
                component={BookingStep3Staff}
                options={bookingStepOptions('Выбор мастера')}
            />
            <Stack.Screen
                name="BookingStep4Date"
                component={BookingStep4Date}
                options={bookingStepOptions('Выбор даты')}
            />
            <Stack.Screen
                name="BookingStep5Time"
                component={BookingStep5Time}
                options={bookingStepOptions('Выбор времени')}
            />
            <Stack.Screen
                name="BookingStep6Confirm"
                component={BookingStep6Confirm}
                options={bookingStepOptions('Подтверждение')}
            />
            <Stack.Screen
                name="Shifts"
                component={ShiftsScreen}
                options={{
                    title: 'Смены и статистика',
                    headerBackTitle: 'Назад',
                }}
            />
            <Stack.Screen
                name="ShiftQuick"
                component={ShiftQuickScreen}
                options={{
                    title: 'Моя смена',
                    headerBackTitle: 'Назад',
                }}
            />
        </>
    );
}
