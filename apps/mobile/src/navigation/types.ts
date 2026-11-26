import type { NavigatorScreenParams } from '@react-navigation/native';

import type { ManageRouteParams } from '../screens/manage/manageMenu';

export type RootStackParamList = {
    /** Signed out only: the sign-in flow, opened over the screen that asked for it (C1). */
    Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
    Main: NavigatorScreenParams<MainTabParamList>;
    Map: undefined;
    BookingDetails: { id: string };
    /** The public business page (/b/<slug>), before the booking steps. */
    Business: { slug: string; previewName?: string };
    Booking: { slug: string; previewName?: string };
    BookingStep1Branch: { slug: string };
    BookingStep2Service: undefined;
    BookingStep3Staff: undefined;
    BookingStep4Date: undefined;
    BookingStep5Time: undefined;
    BookingStep6Confirm: undefined;
    Shifts: undefined;
    ShiftQuick: undefined;
    /** The master's own working hours, this week and next (S3). */
    StaffSchedule: undefined;
    /** Business management: the website's /dashboard home, bookings, analytics, finance, packages, applications. */
    ManageOverview: ManageRouteParams;
    ManageBookings: ManageRouteParams;
    ManageAnalytics: ManageRouteParams;
    ManageFinance: ManageRouteParams;
    /** One master's finance stats of the period (the website's /api/dashboard/finance/[id]/stats). */
    ManageFinanceStaff: ManageRouteParams & { staffId: string; staffName?: string | null };
    ManageVisitPackages: ManageRouteParams;
    /** A visit package type: new without planId, else edited. */
    ManageVisitPackagePlan: ManageRouteParams & { planId?: string };
    ManageRoleApplications: ManageRouteParams;
};

export type MainTabParamList = {
    Home: undefined;
    Cabinet: NavigatorScreenParams<CabinetStackParamList>;
    Dashboard: undefined;
    Staff: undefined;
};

export type CabinetStackParamList = {
    CabinetMain: undefined;
    Profile: undefined;
};

export type AuthStackParamList = {
    SignIn: undefined;
    Verify: { phone?: string; email?: string };
    WhatsApp: undefined;
};
