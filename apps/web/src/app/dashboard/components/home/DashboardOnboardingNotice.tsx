type DashboardOnboardingNoticeProps = {
    title: string;
    items: string[];
    summaryLabel: string;
};

export function DashboardOnboardingNotice({
    title,
    items,
    summaryLabel,
}: DashboardOnboardingNoticeProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section className="rounded-[26px] border border-amber-200/80 bg-amber-50/85 px-4 py-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/35">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v3m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
                            />
                        </svg>
                    </div>
                    <div>
                        <p className="type-label text-amber-900 dark:text-amber-100">{summaryLabel}</p>
                        <h2 className="type-section-title mt-1 text-amber-950 dark:text-amber-50">{title}</h2>
                    </div>
                </div>
                <div className="rounded-full border border-amber-200/80 bg-white/70 px-3 py-2 text-xs font-medium text-amber-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-900/40 dark:text-amber-100">
                    {items.length} open
                </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
                {items.map((item, index) => (
                    <div
                        key={item}
                        className="flex gap-3 rounded-2xl border border-amber-200/70 bg-white/75 px-3 py-3 text-amber-950 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-50"
                    >
                        <span className="type-label inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                            {index + 1}
                        </span>
                        <p className="type-body">{item}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
