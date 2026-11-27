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
import ManageStaffDetailScreen from '../screens/manageStaff/ManageStaffDetailScreen';
import ManageStaffFinanceScreen from '../screens/manageStaff/ManageStaffFinanceScreen';
import ManageStaffFinanceStatsScreen from '../screens/manageStaff/ManageStaffFinanceStatsScreen';
import ManageStaffListScreen from '../screens/manageStaff/ManageStaffListScreen';
import ManageStaffNewScreen from '../screens/manageStaff/ManageStaffNewScreen';
import ManageStaffScheduleScreen from '../screens/manageStaff/ManageStaffScheduleScreen';
import ManageStaffSlotsScreen from '../screens/manageStaff/ManageStaffSlotsScreen';
import StaffCreateBookingScreen from '../screens/StaffCreateBookingScreen';
import BusinessApplyScreen from '../screens/apply/BusinessApplyScreen';
import RoleApplicationScreen from '../screens/apply/RoleApplicationScreen';
import RoleApplyScreen from '../screens/apply/RoleApplyScreen';
import PromotionsScreen from '../screens/business/PromotionsScreen';
import ManageAnalyticsScreen from '../screens/manage/analytics/ManageAnalyticsScreen';
import ManageBookingsScreen from '../screens/manage/bookings/ManageBookingsScreen';
import ManageFinanceScreen from '../screens/manage/finance/ManageFinanceScreen';
import ManageFinanceStaffScreen from '../screens/manage/finance/ManageFinanceStaffScreen';
import ManageOverviewScreen from '../screens/manage/overview/ManageOverviewScreen';
import ManageRoleApplicationsScreen from '../screens/manage/roleApplications/ManageRoleApplicationsScreen';
import ManageVisitPackagePlanScreen from '../screens/manage/visitPackages/ManageVisitPackagePlanScreen';
import ManageVisitPackagesScreen from '../screens/manage/visitPackages/ManageVisitPackagesScreen';
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
// The business management screens (the website's /dashboard/staff/*): a session is required; the web API checks the manager role.
const GuardedManageStaffListScreen = withSessionGate(ManageStaffListScreen, 'workspace');
const GuardedManageStaffNewScreen = withSessionGate(ManageStaffNewScreen, 'workspace');
const GuardedManageStaffDetailScreen = withSessionGate(ManageStaffDetailScreen, 'workspace');
const GuardedManageStaffScheduleScreen = withSessionGate(ManageStaffScheduleScreen, 'workspace');
const GuardedManageStaffSlotsScreen = withSessionGate(ManageStaffSlotsScreen, 'workspace');
const GuardedManageStaffFinanceScreen = withSessionGate(ManageStaffFinanceScreen, 'workspace');
const GuardedManageStaffFinanceStatsScreen = withSessionGate(ManageStaffFinanceStatsScreen, 'workspace');

const GuardedStaffCreateBookingScreen = withSessionGate(withStaffRouteGuard(StaffCreateBookingScreen), 'workspace');

/**
 * Screens of the website brought into the app: promotions, the business and role applications and
 * the master's own booking of a client. Signed out, the applications show their sign-in gate.
 */
function ParityStackScreens(Stack: RootStack, t: Translate) {
    const detail = (title: string, eyebrow: string): NativeStackNavigationOptions => ({
        ...detailStackScreenOptions,
        title,
        headerTitle: createNavigationHeaderTitle(title, eyebrow),
    });
    return (
        <>
            <Stack.Screen
                name="Promotions"
                component={PromotionsScreen}
                options={detail(t('parity.nav.promotions'), t('nav.eyebrow.discovery'))}
            />
            <Stack.Screen
                name="BusinessApply"
                component={BusinessApplyScreen}
                options={detail(t('parity.nav.businessApply'), t('parity.nav.eyebrowBusiness'))}
            />
            <Stack.Screen
                name="RoleApply"
                component={RoleApplyScreen}
                options={detail(t('parity.nav.roleApply'), t('parity.nav.eyebrowBusiness'))}
            />
            <Stack.Screen
                name="RoleApplication"
                component={RoleApplicationScreen}
                options={({ route }) => detail(
                    t(route.params.mode === 'owner' ? 'parity.nav.roleApplicationOwner' : 'parity.nav.roleApplicationStaff'),
                    t('parity.nav.eyebrowBusiness'),
                )}
            />
            <Stack.Screen
                name="StaffCreateBooking"
                component={GuardedStaffCreateBookingScreen}
                options={detail(t('parity.staffBooking.title'), t('nav.eyebrow.workspace'))}
            />
        </>
    );
}

/** The business management screens (owner, admin, manager; the server checks the role). */
const MANAGE_OPS_SCREENS = [
    { name: 'ManageOverview', component: withSessionGate(ManageOverviewScreen, 'workspace'), title: 'ops.menu.overview' },
    { name: 'ManageBookings', component: withSessionGate(ManageBookingsScreen, 'workspace'), title: 'ops.menu.bookings' },
    { name: 'ManageAnalytics', component: withSessionGate(ManageAnalyticsScreen, 'workspace'), title: 'ops.menu.analytics' },
    { name: 'ManageFinance', component: withSessionGate(ManageFinanceScreen, 'workspace'), title: 'ops.menu.finance' },
    { name: 'ManageFinanceStaff', component: withSessionGate(ManageFinanceStaffScreen, 'workspace'), title: 'ops.menu.financeStaff' },
    { name: 'ManageVisitPackages', component: withSessionGate(ManageVisitPackagesScreen, 'workspace'), title: 'ops.menu.visitPackages' },
    { name: 'ManageVisitPackagePlan', component: withSessionGate(ManageVisitPackagePlanScreen, 'workspace'), title: 'ops.menu.visitPackagePlan' },
    { name: 'ManageRoleApplications', component: withSessionGate(ManageRoleApplicationsScreen, 'workspace'), title: 'ops.menu.roleApplications' },
] as const;

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
                    headerTitle: createNavigationHeaderTitle(t('catalog.dashboard.nav.services'), t('ops.menu.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageServiceEdit"
                component={GuardedServiceEditScreen}
                options={({ route }) => ({
                    ...detailStackScreenOptions,
                    title: t(route.params.serviceId ? 'catalog.services.edit.title' : 'catalog.services.form.titleNew'),
                    headerTitle: createNavigationHeaderTitle(t(route.params.serviceId ? 'catalog.services.edit.title' : 'catalog.services.form.titleNew'), t('ops.menu.eyebrow')),
                })}
            />
            <Stack.Screen
                name="ManageBranches"
                component={GuardedBranchesScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('catalog.dashboard.nav.branches'),
                    headerTitle: createNavigationHeaderTitle(t('catalog.dashboard.nav.branches'), t('ops.menu.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageBranchEdit"
                component={GuardedBranchEditScreen}
                options={({ route }) => ({
                    ...detailStackScreenOptions,
                    title: t(route.params.branchId ? 'catalog.branches.edit.title' : 'catalog.branches.new.title'),
                    headerTitle: createNavigationHeaderTitle(t(route.params.branchId ? 'catalog.branches.edit.title' : 'catalog.branches.new.title'), t('ops.menu.eyebrow')),
                })}
            />
            <Stack.Screen
                name="ManageBranchSchedule"
                component={GuardedBranchScheduleScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('catalog.branches.schedule.title'),
                    headerTitle: createNavigationHeaderTitle(t('catalog.branches.schedule.title'), t('ops.menu.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageBranchPromotions"
                component={GuardedBranchPromotionsScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('catalog.branches.promotions.title'),
                    headerTitle: createNavigationHeaderTitle(t('catalog.branches.promotions.title'), t('ops.menu.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageSettings"
                component={GuardedBusinessSettingsScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('catalog.dashboard.nav.settings'),
                    headerTitle: createNavigationHeaderTitle(t('catalog.dashboard.nav.settings'), t('ops.menu.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageStaff"
                component={GuardedManageStaffListScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('manageStaff.nav.list'),
                    headerTitle: createNavigationHeaderTitle(t('manageStaff.nav.list'), t('manageStaff.nav.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageStaffNew"
                component={GuardedManageStaffNewScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('manageStaff.nav.new'),
                    headerTitle: createNavigationHeaderTitle(t('manageStaff.nav.new'), t('manageStaff.nav.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageStaffDetail"
                component={GuardedManageStaffDetailScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('manageStaff.nav.detail'),
                    headerTitle: createNavigationHeaderTitle(t('manageStaff.nav.detail'), t('manageStaff.nav.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageStaffSchedule"
                component={GuardedManageStaffScheduleScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('manageStaff.nav.schedule'),
                    headerTitle: createNavigationHeaderTitle(t('manageStaff.nav.schedule'), t('manageStaff.nav.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageStaffSlots"
                component={GuardedManageStaffSlotsScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('manageStaff.nav.slots'),
                    headerTitle: createNavigationHeaderTitle(t('manageStaff.nav.slots'), t('manageStaff.nav.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageStaffFinance"
                component={GuardedManageStaffFinanceScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('manageStaff.nav.finance'),
                    headerTitle: createNavigationHeaderTitle(t('manageStaff.nav.finance'), t('manageStaff.nav.eyebrow')),
                }}
            />
            <Stack.Screen
                name="ManageStaffFinanceStats"
                component={GuardedManageStaffFinanceStatsScreen}
                options={{
                    ...detailStackScreenOptions,
                    title: t('manageStaff.nav.financeStats'),
                    headerTitle: createNavigationHeaderTitle(t('manageStaff.nav.financeStats'), t('manageStaff.nav.eyebrow')),
                }}
            />
            {ParityStackScreens(Stack, t)}
            {MANAGE_OPS_SCREENS.map((screen) => (
                <Stack.Screen
                    key={screen.name}
                    name={screen.name}
                    component={screen.component}
                    options={{
                        ...detailStackScreenOptions,
                        title: t(screen.title),
                        headerTitle: createNavigationHeaderTitle(t(screen.title), t('ops.menu.eyebrow')),
                    }}
                />
            ))}
        </>
    );
}
