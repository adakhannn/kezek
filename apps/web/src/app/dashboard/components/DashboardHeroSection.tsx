type DashboardHeroSectionProps = {
    displayBizName: string;
    bizCity: string | null;
    formattedDateLocalized: string;
    bookingsToday: number;
    staffActive: number;
    t: (key: string, fallback?: string) => string;
};

export function DashboardHeroSection({
    displayBizName,
    bizCity,
    formattedDateLocalized,
    bookingsToday,
    staffActive,
    t,
}: DashboardHeroSectionProps) {
    return (
        <section className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-lg">
            <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-7">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        {t('dashboard.header.badge', 'Кабинет владельца бизнеса')}
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{displayBizName}</h1>
                        <p className="mt-1 text-sm text-indigo-100/90 lg:text-base">
                            {formattedDateLocalized}
                            {bizCity ? ` · ${bizCity}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs lg:text-sm">
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                            {bookingsToday}
                        </span>
                        <div className="leading-tight">
                            <div className="font-medium">{t('dashboard.stats.bookingsToday', 'Брони сегодня')}</div>
                            <div className="text-indigo-100/80">{t('dashboard.stats.bookingsTodayHint', 'в календаре записи')}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                            {staffActive}
                        </span>
                        <div className="leading-tight">
                            <div className="font-medium">{t('dashboard.stats.activeStaff', 'Активных сотрудников')}</div>
                            <div className="text-indigo-100/80">{t('dashboard.stats.activeStaffHint', 'готовы принимать клиентов')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
