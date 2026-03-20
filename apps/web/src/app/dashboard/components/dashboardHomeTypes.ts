export type DashboardHomeClientProps = {
    bizName: string | null;
    bizCity: string | null;
    formattedDate: string;
    bookingsToday: number;
    staffActive: number;
    servicesActive: number;
    branchesCount: number;
    needOnboarding: boolean;
    ratingScore: number | null;
    ratingConfigScope?: 'biz' | 'global' | null;
    ratingWeights: {
        reviews: number;
        productivity: number;
        loyalty: number;
        discipline: number;
        windowDays: number;
    } | null;
};
