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
    /** Business management (screens/manage/catalog): the website's /dashboard/services, /branches, /settings. */
    ManageServices: ManageRouteParams;
    /** No serviceId: a new service. */
    ManageServiceEdit: ManageRouteParams & { serviceId?: string };
    ManageBranches: ManageRouteParams;
    /** No branchId: a new branch. */
    ManageBranchEdit: ManageRouteParams & { branchId?: string };
    ManageBranchSchedule: ManageRouteParams & { branchId: string; branchName?: string };
    ManageBranchPromotions: ManageRouteParams & { branchId: string; branchName?: string; bizSlug?: string | null };
    ManageSettings: ManageRouteParams;
    /** The manager's staff section (/dashboard/staff): list, invitation, card and its pages. */
    ManageStaff: ManageRouteParams;
    ManageStaffNew: ManageRouteParams;
    ManageStaffDetail: ManageStaffRouteParams;
    ManageStaffSchedule: ManageStaffRouteParams;
    ManageStaffSlots: ManageStaffRouteParams;
    ManageStaffFinance: ManageStaffRouteParams;
    ManageStaffFinanceStats: ManageStaffRouteParams;
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
    /** Super-admin screens (the website's /admin/*); every route checks the role on the server. */
    AdminAnalytics: undefined;
    AdminSystemAnalytics: undefined;
    AdminFunnelAnalytics: undefined;
    AdminSystemHealth: undefined;
    AdminHealthCheck: undefined;
    AdminMonitoring: undefined;
    AdminPerformance: undefined;
    AdminRatingConfig: undefined;
    AdminRatingsStatus: undefined;
    AdminRatingsDebug: undefined;
    AdminPromotionsDebug: undefined;
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
