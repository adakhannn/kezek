import type { NavigatorScreenParams } from '@react-navigation/native';

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
    /** The master books a client who calls or walks in (web /staff/bookings "Создать запись"). */
    StaffCreateBooking: undefined;
    /** Every active promotion of a business by branch (web /b/<slug>/promotions). */
    Promotions: { slug: string; previewName?: string };
    /** Connect a new business to Kezek (web /business/apply). */
    BusinessApply: undefined;
    /** Owner or staff application to an existing business (web /business/role-apply). */
    RoleApply: undefined;
    /** Web /business/owner-apply and /business/staff-apply. */
    RoleApplication: { mode: 'owner' | 'staff' };
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
