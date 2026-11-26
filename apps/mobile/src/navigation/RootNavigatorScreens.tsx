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
import BusinessScreen from '../screens/business/BusinessScreen';
import BranchEditScreen from '../screens/manage/catalog/BranchEditScreen';
import BranchesScreen from '../screens/manage/catalog/BranchesScreen';
import BranchPromotionsScreen from '../screens/manage/catalog/BranchPromotionsScreen';
import BranchScheduleScreen from '../screens/manage/catalog/BranchScheduleScreen';
import BusinessSettingsScreen from '../screens/manage/catalog/BusinessSettingsScreen';
import ServiceEditScreen from '../screens/manage/catalog/ServiceEditScreen';
import ServicesScreen from '../screens/manage/catalog/ServicesScreen';
import MapScreen from '../screens/MapScreen';
import ShiftsScreen from '../screens/ShiftsScreen';
import ShiftQuickScreen from '../screens/ShiftQuickScreen';
import StaffScheduleScreen from '../screens/StaffScheduleScreen';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import {
    createFlowScreenOptions,
    createNavigationHeaderTitle,
    detailStackScreenOptions,
} from './mainNavigatorConfig';
import { withSessionGate } from './SessionGate';
import { withStaffRouteGuard } from './StaffRouteGuard';
import type { RootStackParamList } from './types';

/** The root navigator these screens belong to (RootNavigator.tsx). */
type RootStack = ReturnType<typeof createNativeStackNavigator<RootStackParamList>>;

// Account screens stay registered signed out, so a deep link to them is kept: they show the
// sign-in entry until a session exists, then their content (C1). The staff guard runs after it.
const GuardedBookingDetailsScreen = withSessionGate(BookingDetailsScreen, 'booking');
const GuardedShiftsScreen = withSessionGate(withStaffRouteGuard(ShiftsScreen), 'workspace');
const GuardedShiftQuickScreen = withSessionGate(withStaffRouteGuard(ShiftQuickScreen), 'workspace');
const GuardedStaffScheduleScreen = withSessionGate(withStaffRouteGuard(StaffScheduleScreen), 'workspace');
// Business management (the website's /dashboard/services, /branches, /settings); the server checks the role.
const GuardedServicesScreen = withSessionGate(ServicesScreen, 'workspace');
const GuardedServiceEditScreen = withSessionGate(ServiceEditScreen, 'workspace');
const GuardedBranchesScreen = withSessionGate(BranchesScreen, 'workspace');
const GuardedBranchEditScreen = withSessionGate(BranchEditScreen, 'workspace');
const GuardedBranchScheduleScreen = withSessionGate(BranchScheduleScreen, 'workspace');
const GuardedBranchPromotionsScreen = withSessionGate(BranchPromotionsScreen, 'workspace');
const GuardedBusinessSettingsScreen = withSessionGate(BusinessSettingsScreen, 'workspace');

export const rootStackScreenOptions: NativeStackNavigationOptions =
    detailStackScreenOptions;

const bookingStepOptions = (
    title: string,
    stepLabel: string,
): NativeStackNavigationOptions =>
    createFlowScreenOptions(title, stepLabel, {
        headerRight: () => <BookingCancelButton />,
    });

/**
 * Registered only while nobody is signed in: opened over the screen that asked for it, and removed
 * from the stack by the sign-in itself, which returns the user to that screen.
 */
export function AuthStackScreen(Stack: RootStack) {
    return (
        <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ headerShown: false, presentation: 'modal' }}
        />
    );
}

/**
 * Every screen of the app, with or without a session (Apple 5.1.1: browsing needs no account).
 * `t` comes from RootNavigator, so the titles follow the app language.
 */
export function AppStackScreens(Stack: RootStack, t: Translate) {
    return (
        <>
            <Stack.Screen
                name="Main"
                component={MainNavigator}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="BookingDetails"
                component={GuardedBookingDetailsScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('nav.bookingDetails'),
                    headerTitle: createNavigationHeaderTitle(t('nav.bookingDetails'), t('nav.eyebrow.booking')),
                }}
            />
            <Stack.Screen
                name="Map"
                component={MapScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('nav.map'),
                    headerTitle: createNavigationHeaderTitle(t('nav.map'), t('nav.eyebrow.discovery')),
                }}
            />
            <Stack.Screen
                name="Business"
                component={BusinessScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('nav.businessPage'),
                    headerTitle: createNavigationHeaderTitle(t('nav.businessPage'), t('nav.eyebrow.discovery')),
                }}
            />
            <Stack.Screen
                name="Booking"
                component={BookingScreen}
                // The first step is drawn here (BookingStep1Branch inside BookingScreen): it gets the
                // same header as the other steps, with back and cancel.
                options={bookingStepOptions(t('nav.booking.branch'), '1 / 6')}
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
                    headerTitle: createNavigationHeaderTitle(t('nav.shifts'), t('nav.eyebrow.workspace')),
                }}
            />
            <Stack.Screen
                name="ShiftQuick"
                component={GuardedShiftQuickScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('nav.shiftQuick'),
                    headerTitle: createNavigationHeaderTitle(t('nav.shiftQuick'), t('nav.eyebrow.workspace')),
                }}
            />
            <Stack.Screen
                name="StaffSchedule"
                component={GuardedStaffScheduleScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('staff.schedule.title'),
                    headerTitle: createNavigationHeaderTitle(t('staff.schedule.title'), t('nav.eyebrow.workspace')),
                }}
            />
            <Stack.Screen
                name="ManageServices"
                component={GuardedServicesScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('catalog.dashboard.nav.services'),
                    headerTitle: createNavigationHeaderTitle(t('catalog.dashboard.nav.services'), t('nav.eyebrow.workspace')),
                }}
            />
            <Stack.Screen
                name="ManageServiceEdit"
                component={GuardedServiceEditScreen}
                options={({ route }) => ({
                    ...detailStackScreenOptions,
                    title: t(route.params.serviceId ? 'catalog.services.edit.title' : 'catalog.services.form.titleNew'),
                    headerTitle: createNavigationHeaderTitle(t(route.params.serviceId ? 'catalog.services.edit.title' : 'catalog.services.form.titleNew'), t('nav.eyebrow.workspace')),
                })}
            />
            <Stack.Screen
                name="ManageBranches"
                component={GuardedBranchesScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('catalog.dashboard.nav.branches'),
                    headerTitle: createNavigationHeaderTitle(t('catalog.dashboard.nav.branches'), t('nav.eyebrow.workspace')),
                }}
            />
            <Stack.Screen
                name="ManageBranchEdit"
                component={GuardedBranchEditScreen}
                options={({ route }) => ({
                    ...detailStackScreenOptions,
                    title: t(route.params.branchId ? 'catalog.branches.edit.title' : 'catalog.branches.new.title'),
                    headerTitle: createNavigationHeaderTitle(t(route.params.branchId ? 'catalog.branches.edit.title' : 'catalog.branches.new.title'), t('nav.eyebrow.workspace')),
                })}
            />
            <Stack.Screen
                name="ManageBranchSchedule"
                component={GuardedBranchScheduleScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('catalog.branches.schedule.title'),
                    headerTitle: createNavigationHeaderTitle(t('catalog.branches.schedule.title'), t('nav.eyebrow.workspace')),
                }}
            />
            <Stack.Screen
                name="ManageBranchPromotions"
                component={GuardedBranchPromotionsScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('catalog.branches.promotions.title'),
                    headerTitle: createNavigationHeaderTitle(t('catalog.branches.promotions.title'), t('nav.eyebrow.workspace')),
                }}
            />
            <Stack.Screen
                name="ManageSettings"
                component={GuardedBusinessSettingsScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('catalog.dashboard.nav.settings'),
                    headerTitle: createNavigationHeaderTitle(t('catalog.dashboard.nav.settings'), t('nav.eyebrow.workspace')),
                }}
            />
        </>
    );
}
