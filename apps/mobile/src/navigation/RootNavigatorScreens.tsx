import React from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

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
import {
    createFlowScreenOptions,
    createNavigationHeaderTitle,
    detailStackScreenOptions,
} from './mainNavigatorConfig';

export const rootStackScreenOptions: NativeStackNavigationOptions = detailStackScreenOptions;

const bookingStepOptions = (
    title: string,
    stepLabel: string,
): NativeStackNavigationOptions =>
    createFlowScreenOptions(title, stepLabel, {
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
                options={{
                    ...detailStackScreenOptions,
                    title: 'Р”РµС‚Р°Р»Рё Р·Р°РїРёСЃРё',
                    headerTitle: createNavigationHeaderTitle('Р”РµС‚Р°Р»Рё Р·Р°РїРёСЃРё', 'Booking'),
                }}
            />
            <Stack.Screen
                name="Booking"
                component={BookingScreen}
                options={{ title: 'Р—Р°РїРёСЃСЊ', headerShown: false }}
            />
            <Stack.Screen
                name="BookingStep1Branch"
                component={BookingStep1Branch}
                options={bookingStepOptions('Р’С‹Р±РѕСЂ С„РёР»РёР°Р»Р°', '1 / 6')}
            />
            <Stack.Screen
                name="BookingStep2Service"
                component={BookingStep2Service}
                options={bookingStepOptions('Р’С‹Р±РѕСЂ СѓСЃР»СѓРіРё', '2 / 6')}
            />
            <Stack.Screen
                name="BookingStep3Staff"
                component={BookingStep3Staff}
                options={bookingStepOptions('Р’С‹Р±РѕСЂ РјР°СЃС‚РµСЂР°', '3 / 6')}
            />
            <Stack.Screen
                name="BookingStep4Date"
                component={BookingStep4Date}
                options={bookingStepOptions('Р’С‹Р±РѕСЂ РґР°С‚С‹', '4 / 6')}
            />
            <Stack.Screen
                name="BookingStep5Time"
                component={BookingStep5Time}
                options={bookingStepOptions('Р’С‹Р±РѕСЂ РІСЂРµРјРµРЅРё', '5 / 6')}
            />
            <Stack.Screen
                name="BookingStep6Confirm"
                component={BookingStep6Confirm}
                options={bookingStepOptions('РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ', '6 / 6')}
            />
            <Stack.Screen
                name="Shifts"
                component={ShiftsScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: 'РЎРјРµРЅС‹ Рё СЃС‚Р°С‚РёСЃС‚РёРєР°',
                    headerTitle: createNavigationHeaderTitle('РЎРјРµРЅС‹ Рё СЃС‚Р°С‚РёСЃС‚РёРєР°', 'Workspace'),
                }}
            />
            <Stack.Screen
                name="ShiftQuick"
                component={ShiftQuickScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: 'РњРѕСЏ СЃРјРµРЅР°',
                    headerTitle: createNavigationHeaderTitle('РњРѕСЏ СЃРјРµРЅР°', 'Workspace'),
                }}
            />
        </>
    );
}
