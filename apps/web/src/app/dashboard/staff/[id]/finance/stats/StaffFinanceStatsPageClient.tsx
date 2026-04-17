'use client';

import FinanceSettingsAuditLog from '../components/FinanceSettingsAuditLog';
import StaffFinanceStats from '../components/StaffFinanceStats';

import { ErrorBanner } from '@/app/_components/ErrorBanner';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

export default function StaffFinanceStatsPageClient({
    id,
    fullName,
}: {
    id: string;
    fullName: string | null;
}) {
    const { t } = useLanguage();

    return (
        <div className="mx-auto max-w-[var(--container-2xl)] space-y-6 px-4 py-6 lg:px-8 lg:py-8">
            <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-md)]">
                <PageHeader
                    eyebrow={
                        <div className="flex flex-wrap items-center gap-2">
                            <a
                                href={`/dashboard/staff/${id}/finance`}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-default)]"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                {t('staff.finance.backToShift', 'Back to shift workspace')}
                            </a>
                            <Badge variant="accent">{t('finance.staffStats.title', 'Finance analytics')}</Badge>
                        </div>
                    }
                    title={`${t('finance.staffStats.title', 'Staff finance stats')}: ${fullName ?? ''}`}
                    description={t(
                        'finance.staffStats.subtitle',
                        'Review money distribution, guarantees, shifts, and operational risks for everyday financial control.',
                    )}
                    meta={
                        <div className="grid gap-2 sm:grid-cols-3">
                            <Card variant="outlined" padding="sm">
                                <p className="type-label text-[var(--text-secondary)]">Money</p>
                                <p className="type-caption mt-1 text-[var(--text-muted)]">
                                    {t('finance.meta.money', 'Turnover and split between employee and business.')}
                                </p>
                            </Card>
                            <Card variant="outlined" padding="sm">
                                <p className="type-label text-[var(--text-secondary)]">Guarantees</p>
                                <p className="type-caption mt-1 text-[var(--text-muted)]">
                                    {t('finance.meta.guarantees', 'Base share versus guaranteed top-ups and edited hours.')}
                                </p>
                            </Card>
                            <Card variant="outlined" padding="sm">
                                <p className="type-label text-[var(--text-secondary)]">Audit</p>
                                <p className="type-caption mt-1 text-[var(--text-muted)]">
                                    {t('finance.meta.audit', 'Who changed percentages and hourly settings, and when.')}
                                </p>
                            </Card>
                        </div>
                    }
                />
            </section>

            <Card variant="default" padding="lg">
                <ErrorBoundary
                    onError={(error, errorInfo) => {
                        const { logError } = require('@/lib/log');
                        logError('StaffFinanceStatsPage', 'StaffFinanceStats error', { error, errorInfo });
                    }}
                    fallback={
                        <ErrorBanner
                            variant="internal"
                            title={t('staff.finance.stats.error.boundary.title', 'Stats component error')}
                            message={t(
                                'staff.finance.stats.error.boundary.message',
                                'The stats component failed to render. Try reloading this page.',
                            )}
                            onRetry={() => window.location.reload()}
                        />
                    }
                >
                    <StaffFinanceStats staffId={id} />
                    <FinanceSettingsAuditLog staffId={id} />
                </ErrorBoundary>
            </Card>
        </div>
    );
}
