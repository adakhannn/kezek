import type { NavigatorScreenParams } from '@react-navigation/native';

import type { ManageRouteParams } from '../screens/manage/manageMenu';

/** A staff card of the managed business (the website's /dashboard/staff/[id]/*). */
export type ManageStaffRouteParams = ManageRouteParams & { staffId: string; staffName?: string };

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
    /** The manager's staff section (/dashboard/staff): list, invitation, card and its pages. */
    ManageStaff: ManageRouteParams;
    ManageStaffNew: ManageRouteParams;
    ManageStaffDetail: ManageStaffRouteParams;
    ManageStaffSchedule: ManageStaffRouteParams;
    ManageStaffSlots: ManageStaffRouteParams;
    ManageStaffFinance: ManageStaffRouteParams;
    ManageStaffFinanceStats: ManageStaffRouteParams;
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
