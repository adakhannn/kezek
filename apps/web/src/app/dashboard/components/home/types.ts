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
    ratingConfigScope: 'biz' | 'global' | null;
    ratingWeights: {
        reviews: number;
        productivity: number;
        loyalty: number;
        discipline: number;
        windowDays: number;
    } | null;
};

export type DashboardMetricCard = {
    key: string;
    value: number;
    title: string;
    hint: string;
    href: string;
    actionLabel: string;
    borderClassName: string;
    iconWrapperClassName: string;
    linkClassName: string;
    icon: React.ReactNode;
};

export type DashboardQuickAction = {
    key: string;
    href: string;
    title: string;
    hint: string;
    emphasis: string;
    className: string;
    hintClassName: string;
};

export type DashboardRatingFactor = {
    key: string;
    label: string;
    value: number;
    dotClassName: string;
};

export type DashboardHomeFocus = {
    title: string;
    description: string;
    ctaLabel: string;
    href: string;
    tone: 'warning' | 'info' | 'success';
};
