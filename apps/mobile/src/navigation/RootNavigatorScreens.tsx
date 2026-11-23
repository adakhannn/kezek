import React from 'react';
import type { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';

import BookingCancelButton from '../components/BookingCancelButton';
import type { Translate } from '../i18n';
import BookingDetailsScreen from '../screens/BookingDetailsScreen';
import BookingScreen from '../screens/BookingScreen';
import BookingStep1Branch from '../screens/booking/BookingStep1Branch';
import BookingStep2Service from '../screens/booking/BookingStep2Service';
import BookingStep3Staff from '../screens/booking/BookingStep3Staff';
import BookingStep4Date from '../screens/booking/BookingStep4Date';
import BookingStep5Time from '../screens/booking/BookingStep5Time';
import BookingStep6Confirm from '../screens/booking/BookingStep6Confirm';
import MapScreen from '../screens/MapScreen';
import ShiftsScreen from '../screens/ShiftsScreen';
import ShiftQuickScreen from '../screens/ShiftQuickScreen';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import {
    createFlowScreenOptions,
    createNavigationHeaderTitle,
    detailStackScreenOptions,
} from './mainNavigatorConfig';
import { withStaffRouteGuard } from './StaffRouteGuard';
import type { RootStackParamList } from './types';

/** The root navigator these screens belong to (RootNavigator.tsx). */
type RootStack = ReturnType<typeof createNativeStackNavigator<RootStackParamList>>;

const GuardedShiftsScreen = withStaffRouteGuard(ShiftsScreen);
const GuardedShiftQuickScreen = withStaffRouteGuard(ShiftQuickScreen);

export const rootStackScreenOptions: NativeStackNavigationOptions =
    detailStackScreenOptions;

const bookingStepOptions = (
    title: string,
    stepLabel: string,
): NativeStackNavigationOptions =>
    createFlowScreenOptions(title, stepLabel, {
        headerRight: () => <BookingCancelButton />,
    });

export function AuthStackScreen(Stack: RootStack) {
    return (
        <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ headerShown: false }}
        />
    );
}

/** `t` comes from RootNavigator, so the titles follow the app language. */
export function SignedInStackScreens(Stack: RootStack, t: Translate) {
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
                options={{
                    ...detailStackScreenOptions,
                    title: t('nav.bookingDetails'),
                    headerTitle: createNavigationHeaderTitle(t('nav.bookingDetails'), 'Booking'),
                }}
            />
            <Stack.Screen
                name="Map"
                component={MapScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('nav.map'),
                    headerTitle: createNavigationHeaderTitle(t('nav.map'), 'Discovery'),
                }}
            />
            <Stack.Screen
                name="Booking"
                component={BookingScreen}
                options={{
                    title: t('nav.booking'),
                    headerShown: false,
                    animation: 'none',
                }}
            />
            <Stack.Screen
                name="BookingStep1Branch"
                component={BookingStep1Branch}
                options={bookingStepOptions(t('nav.booking.branch'), '1 / 6')}
            />
            <Stack.Screen
                name="BookingStep2Service"
                component={BookingStep2Service}
                options={bookingStepOptions(t('nav.booking.service'), '2 / 6')}
            />
            <Stack.Screen
                name="BookingStep3Staff"
                component={BookingStep3Staff}
                options={bookingStepOptions(t('nav.booking.staff'), '3 / 6')}
            />
            <Stack.Screen
                name="BookingStep4Date"
                component={BookingStep4Date}
                options={bookingStepOptions(t('nav.booking.date'), '4 / 6')}
            />
            <Stack.Screen
                name="BookingStep5Time"
                component={BookingStep5Time}
                options={bookingStepOptions(t('nav.booking.time'), '5 / 6')}
            />
            <Stack.Screen
                name="BookingStep6Confirm"
                component={BookingStep6Confirm}
                options={bookingStepOptions(t('nav.booking.confirm'), '6 / 6')}
            />
            <Stack.Screen
                name="Shifts"
                component={GuardedShiftsScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('nav.shifts'),
                    headerTitle: createNavigationHeaderTitle(t('nav.shifts'), 'Workspace'),
                }}
            />
            <Stack.Screen
                name="ShiftQuick"
                component={GuardedShiftQuickScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('nav.shiftQuick'),
                    headerTitle: createNavigationHeaderTitle(t('nav.shiftQuick'), 'Workspace'),
                }}
            />
        </>
    );
}
