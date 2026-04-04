import { Badge } from '@/components/ui/Badge';

type DashboardHomeHeroProps = {
    displayBizName: string;
    formattedDateLocalized: string;
    bizCity: string | null;
    bookingsToday: number;
    staffActive: number;
    bookingsTodayLabel: string;
    bookingsTodayHint: string;
    activeStaffLabel: string;
    activeStaffHint: string;
    badgeLabel: string;
};

export function DashboardHomeHero({
    displayBizName,
    formattedDateLocalized,
    bizCity,
    bookingsToday,
    staffActive,
    bookingsTodayLabel,
    bookingsTodayHint,
    activeStaffLabel,
    activeStaffHint,
    badgeLabel,
}: DashboardHomeHeroProps) {
    return (
        <section className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-lg">
            <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-7">
                <div className="space-y-2">
                    <Badge tone="outline" className="border-white/20 bg-white/10 text-white/95">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        {badgeLabel}
                    </Badge>
                    <div>
                        <h1 className="type-page-title text-white">{displayBizName}</h1>
                        <p className="type-caption mt-1 text-indigo-100/90 sm:text-sm lg:text-base">
                            {formattedDateLocalized.charAt(0).toUpperCase() + formattedDateLocalized.slice(1)}
                            {bizCity ? ` В· ${bizCity}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                        <span className="type-label inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-white/20 px-2 text-white">
                            {bookingsToday}
                        </span>
                        <div className="leading-tight">
                            <div className="type-label text-white">{bookingsTodayLabel}</div>
                            <div className="type-caption text-indigo-100/80">{bookingsTodayHint}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                        <span className="type-label inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-white/20 px-2 text-white">
                            {staffActive}
                        </span>
                        <div className="leading-tight">
                            <div className="type-label text-white">{activeStaffLabel}</div>
                            <div className="type-caption text-indigo-100/80">{activeStaffHint}</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
