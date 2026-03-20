type DashboardOnboardingSectionProps = {
    branchesCount: number;
    servicesActive: number;
    staffActive: number;
    bookingsToday: number;
    t: (key: string, fallback?: string) => string;
};

export function DashboardOnboardingSection({
    branchesCount,
    servicesActive,
    staffActive,
    bookingsToday,
    t,
}: DashboardOnboardingSectionProps) {
    return (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3.5 text-sm text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex gap-3">
                <div className="mt-0.5">
                    <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v3m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
                        />
                    </svg>
                </div>
                <div className="space-y-1">
                    <p className="font-medium">{t('dashboard.onboarding.title', 'Давайте доведём кабинет до рабочего состояния.')}</p>
                    <ul className="list-inside list-disc space-y-0.5 text-xs">
                        {branchesCount === 0 && <li>{t('dashboard.onboarding.noBranches', 'Создайте хотя бы один филиал, чтобы клиенты могли записываться.')}</li>}
                        {servicesActive === 0 && <li>{t('dashboard.onboarding.noServices', 'Добавьте услуги и укажите продолжительность и цену.')}</li>}
                        {staffActive === 0 && <li>{t('dashboard.onboarding.noStaff', 'Добавьте сотрудников и укажите, кто оказывает какие услуги.')}</li>}
                        {bookingsToday === 0 && (
                            <li>{t('dashboard.onboarding.noBookings', 'Проверьте «Календарь» — первые бронирования появятся здесь автоматически.')}</li>
                        )}
                    </ul>
                </div>
            </div>
        </section>
    );
}
