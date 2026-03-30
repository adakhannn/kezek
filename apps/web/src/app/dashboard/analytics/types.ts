export type OverviewSummary = {
    period: {
        startDate: string;
        endDate: string;
    };
    bookings: {
        created: number;
        confirmedOrPaid: number;
    };
    funnel: {
        homeViews: number;
        businessPageViews: number;
        bookingFlowStarts: number;
        conversionHomeToBooking: number;
    };
    revenue: {
        total: number;
        promoBookings: number;
        promoRevenue: number;
    };
};

export type OverviewByDayPoint = {
    date: string;
    homeViews: number;
    businessPageViews: number;
    bookingFlowStarts: number;
    bookingsCreated: number;
    bookingsConfirmedOrPaid: number;
    promoBookings: number;
    promoRevenue: number;
    totalRevenue: number;
};

export type OverviewResponse = {
    ok: boolean;
    data?: {
        summary: OverviewSummary;
        byDay: OverviewByDayPoint[];
    };
    error?: string;
};

export type PeriodPreset = '7' | '30' | '90' | 'custom';

export type BranchOption = {
    id: string;
    name: string;
};

export type LoadPoint = {
    date: string;
    hour: number;
    bookingsCount: number;
    promoBookingsCount: number;
};

export type LoadResponse = {
    ok: boolean;
    data?: {
        period: { startDate: string; endDate: string };
        points: LoadPoint[];
    };
    error?: string;
};

export type DashboardTrendChartData = {
    bookings: { x: string; y: number }[];
    revenue: { x: string; y: number }[];
};
