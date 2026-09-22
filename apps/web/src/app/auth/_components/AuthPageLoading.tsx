import { getServerLocale, getT } from '@/app/_components/i18n/server';

export async function AuthPageLoading() {
    const locale = await getServerLocale();
    const t = getT(locale);

    return (
        <section
            aria-busy="true"
            aria-live="polite"
            className="relative flex min-h-[min(32rem,calc(100svh-12rem))] items-center justify-center overflow-hidden px-4 py-10 sm:px-6"
        >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_22%,rgba(99,102,241,0.13),transparent_30%),radial-gradient(circle_at_82%_78%,rgba(244,114,182,0.12),transparent_32%)]" />

            <div className="relative w-full max-w-md rounded-[28px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_92%,transparent)] p-6 text-center shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-inverse)] shadow-[var(--shadow-md)]">
                    <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                </div>

                <h1 className="mt-5 text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">
                    {t('auth.loading.title', 'Готовим вход')}
                </h1>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                    {t('auth.loading.description', 'Проверяем безопасное подключение и открываем способы входа.')}
                </p>

                <div className="mt-6 space-y-3 text-left" aria-hidden="true">
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-emphasis)]">
                        <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]" />
                    </div>
                    <div className="mx-auto h-2 w-3/5 animate-pulse rounded-full bg-[var(--border-subtle)]" />
                </div>

                <p className="mt-5 text-xs text-[var(--text-muted)]">
                    {t('auth.loading.hint', 'Обычно это занимает всего несколько секунд')}
                </p>
            </div>
        </section>
    );
}
