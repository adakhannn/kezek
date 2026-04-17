'use client';

import { ErrorBanner } from '@/app/_components/ErrorBanner';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { FinancePage } from '@/app/staff/finance/components/FinancePage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';

export default function StaffFinancePageClient({
    id,
    fullName,
}: {
    id: string;
    fullName: string | null;
}) {
    const { t } = useLanguage();

    return (
        <div className="mx-auto max-w-[var(--container-2xl)] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-md)] sm:p-5">
                <PageHeader
                    eyebrow={
                        <div className="flex flex-wrap items-center gap-2">
                            <a
                                href={`/dashboard/staff/${id}`}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)]"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                {t('staff.finance.backToStaff', 'Back to staff')}
                            </a>
                            <Badge variant="accent">{t('staff.finance.workspace', 'Staff Finance Workspace')}</Badge>
                        </div>
                    }
                    title={`${t('staff.finance.shift.title', 'Shift workspace')}: ${fullName ?? ''}`}
                    description={t(
                        'staff.finance.shift.subtitle',
                        'Daily money flow, guarantees, client entries, and shift-level actions in one operator-focused workspace.',
                    )}
                    actions={
                        <a
                            href={`/dashboard/staff/${id}/finance/stats`}
                            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-card)]"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            {t('finance.staffStats.title', 'Open stats')}
                        </a>
                    }
                />
            </section>

            <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-md)] min-w-0 overflow-x-hidden">
                <ErrorBoundary
                    onError={(error, errorInfo) => {
                        const { logError } = require('@/lib/log');
                        logError('StaffFinancePage', 'FinancePage error', { error, errorInfo });
                    }}
                    fallback={
                        <div className="p-6">
                            <ErrorBanner
                                variant="internal"
                                title={t('staff.finance.error.boundary.title', 'Finance workspace error')}
                                message={t(
                                    'staff.finance.error.boundary.message',
                                    'The finance workspace failed to render. Try reloading the page.',
                                )}
                                onRetry={() => window.location.reload()}
                            />
                        </div>
                    }
                >
                    <FinancePage staffId={id} showHeader={false} />
                </ErrorBoundary>
            </div>
        </div>
    );
}
