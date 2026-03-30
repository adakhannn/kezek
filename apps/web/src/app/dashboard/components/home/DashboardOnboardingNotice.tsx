type DashboardOnboardingNoticeProps = {
    title: string;
    items: string[];
};

export function DashboardOnboardingNotice({
    title,
    items,
}: DashboardOnboardingNoticeProps) {
    if (items.length === 0) {
        return null;
    }

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
                    <p className="font-medium">{title}</p>
                    <ul className="list-inside list-disc space-y-0.5 text-xs">
                        {items.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}
