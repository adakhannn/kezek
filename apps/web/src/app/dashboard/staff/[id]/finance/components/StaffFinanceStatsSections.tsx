'use client';

import { StaffFinanceShiftCard } from './StaffFinanceShiftCard';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { StaffFinanceStatsPayload, StaffFinanceStatsPeriod } from '@/lib/finance/types';

function formatMoney(value: number, locale: string) {
    return `${value.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом`;
}

function formatPercent(value: number, total: number) {
    if (total <= 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
}

export function StaffFinanceStatsFilters({
    period,
    date,
    loading,
    onPeriodChange,
    onDateChange,
    onRefresh,
    t,
}: {
    period: StaffFinanceStatsPeriod;
    date: string;
    loading: boolean;
    onPeriodChange: (period: StaffFinanceStatsPeriod) => void;
    onDateChange: (date: string) => void;
    onRefresh: () => void;
    t: (key: string, fallback: string) => string;
}) {
    return (
        <Card variant="elevated" padding="md">
            <SectionHeader
                title={t('finance.filters.title', 'Finance filters')}
                description={t('finance.filters.description', 'Switch period and refresh the workspace without leaving the screen.')}
                action={
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-card)] disabled:opacity-50"
                    >
                        {loading ? t('finance.loading', 'Loading...') : t('finance.update', 'Refresh')}
                    </button>
                }
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-[auto_auto_auto_1fr] sm:items-end">
                <div className="flex items-center gap-2">
                    {(['day', 'month', 'year'] as StaffFinanceStatsPeriod[]).map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => onPeriodChange(value)}
                            disabled={loading}
                            className={`rounded-[var(--radius-md)] px-3 py-2 text-xs font-semibold transition ${
                                period === value
                                    ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                                    : 'border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                            } disabled:opacity-50`}
                        >
                            {value === 'day' ? t('finance.period.day', 'Day') : value === 'month' ? t('finance.period.month', 'Month') : t('finance.period.year', 'Year')}
                        </button>
                    ))}
                </div>

                <div className="sm:col-span-2">
                    <label className="type-caption mb-1 block text-[var(--text-secondary)]">
                        {t('finance.filters.dateLabel', 'Reference date')}
                    </label>
                    <input
                        type={period === 'year' ? 'number' : period === 'month' ? 'month' : 'date'}
                        value={period === 'year' ? date.split('-')[0] : period === 'month' ? (date.substring(0, 7) || date) : date}
                        disabled={loading}
                        onChange={(event) => {
                            if (period === 'year') {
                                onDateChange(`${event.target.value}-01-01`);
                            } else if (period === 'month') {
                                onDateChange(event.target.value.length === 7 ? `${event.target.value}-01` : event.target.value);
                            } else {
                                onDateChange(event.target.value);
                            }
                        }}
                        className="min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60"
                    />
                </div>
            </div>
        </Card>
    );
}

export function StaffFinanceStatsRefreshing({ t }: { t: (key: string, fallback: string) => string }) {
    return (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{t('finance.loading', 'Loading...')}</span>
        </div>
    );
}

export function StaffFinanceStatsSummary({
    stats,
    period,
    periodLabel,
    locale,
    t,
}: {
    stats: StaffFinanceStatsPayload;
    period: StaffFinanceStatsPeriod;
    periodLabel: string;
    locale: string;
    t: (key: string, fallback: string) => string;
}) {
    const guaranteeUsed = stats.totalGuaranteedAmount > 0;
    const reviewFlags = [
        stats.totalLateMinutes > 0
            ? `${t('finance.flags.late', 'Late minutes')}: ${stats.totalLateMinutes}`
            : null,
        stats.totalConsumables > 0
            ? `${t('finance.flags.consumables', 'Consumables')}: ${formatMoney(stats.totalConsumables, locale)}`
            : null,
        guaranteeUsed
            ? `${t('finance.flags.guarantee', 'Guarantee top-up')}: ${formatMoney(stats.totalGuaranteedAmount, locale)}`
            : null,
    ].filter((value): value is string => Boolean(value));

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card variant="default" padding="md">
                    <p className="type-label text-[var(--text-secondary)]">{t('finance.staffStats.turnover', 'Turnover')}</p>
                    <p className="type-metric mt-2 text-[var(--text-primary)]">{formatMoney(stats.totalAmount, locale)}</p>
                    <p className="type-caption mt-1 text-[var(--text-muted)]">{periodLabel}</p>
                </Card>

                <Card variant="default" padding="md">
                    <p className="type-label text-[var(--text-secondary)]">{t('finance.staffStats.toEmployee', 'Employee share')}</p>
                    <p className="type-metric mt-2 text-emerald-500">{formatMoney(stats.totalMaster, locale)}</p>
                    <p className="type-caption mt-1 text-[var(--text-muted)]">
                        {formatPercent(stats.totalMaster, stats.totalAmount)} • {t('finance.share.split', 'of turnover')}
                    </p>
                </Card>

                <Card variant="default" padding="md">
                    <p className="type-label text-[var(--text-secondary)]">{t('finance.staffStats.toBusiness', 'Business share')}</p>
                    <p className="type-metric mt-2 text-indigo-500">{formatMoney(stats.totalSalon, locale)}</p>
                    <p className="type-caption mt-1 text-[var(--text-muted)]">
                        {formatPercent(stats.totalSalon, stats.totalAmount)} • {t('finance.share.split', 'of turnover')}
                    </p>
                </Card>

                <Card variant="default" padding="md">
                    <p className="type-label text-[var(--text-secondary)]">{t('finance.guarantees.title', 'Guarantee impact')}</p>
                    <p className="type-metric mt-2 text-amber-500">
                        {guaranteeUsed ? formatMoney(stats.totalGuaranteedAmount, locale) : '0 сом'}
                    </p>
                    <p className="type-caption mt-1 text-[var(--text-muted)]">
                        {guaranteeUsed
                            ? `${t('finance.guarantees.baseShare', 'Base share')}: ${formatMoney(stats.totalBaseMasterShare, locale)}`
                            : t('finance.guarantees.notUsed', 'No guarantee top-up in this period')}
                    </p>
                </Card>
            </div>

            <Card variant="elevated" padding="md">
                <SectionHeader
                    title={t('finance.operational.readout', 'Operational readout')}
                    description={t(
                        'finance.operational.readoutDesc',
                        'Shifts, clients, consumables, late minutes, and review flags for day-to-day financial decisions.',
                    )}
                    badge={<Badge variant={reviewFlags.length > 0 ? 'warning' : 'success'}>{reviewFlags.length > 0 ? t('finance.flags.reviewNeeded', 'Needs review') : t('finance.flags.stable', 'Stable')}</Badge>}
                />

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                        <p className="type-caption text-[var(--text-secondary)]">{t('finance.staffStats.shifts', 'Shifts')}</p>
                        <p className="type-section-title mt-1 text-[var(--text-primary)]">{stats.shiftsCount}</p>
                        <p className="type-caption text-[var(--text-muted)]">
                            {stats.openShiftsCount} {t('finance.shifts.open', 'open')} • {stats.closedShiftsCount} {t('finance.shifts.closed', 'closed')}
                        </p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                        <p className="type-caption text-[var(--text-secondary)]">{t('finance.staffStats.clients', 'Clients')}</p>
                        <p className="type-section-title mt-1 text-[var(--text-primary)]">{stats.totalClients}</p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                        <p className="type-caption text-[var(--text-secondary)]">{t('finance.staffStats.consumables', 'Consumables')}</p>
                        <p className="type-section-title mt-1 text-[var(--text-primary)]">{formatMoney(stats.totalConsumables, locale)}</p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                        <p className="type-caption text-[var(--text-secondary)]">{t('finance.staffStats.late', 'Late')}</p>
                        <p className="type-section-title mt-1 text-[var(--text-primary)]">{stats.totalLateMinutes} min</p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                        <p className="type-caption text-[var(--text-secondary)]">{t('finance.period.label', 'Period')}</p>
                        <p className="type-body mt-1 text-[var(--text-primary)]">{periodLabel}</p>
                        <p className="type-caption text-[var(--text-muted)]">{period}</p>
                    </div>
                </div>

                {reviewFlags.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {reviewFlags.map((flag) => (
                            <Badge key={flag} variant="warning" tone="soft">
                                {flag}
                            </Badge>
                        ))}
                    </div>
                ) : null}
            </Card>
        </div>
    );
}

export function StaffFinanceStatsShifts({
    stats,
    locale,
    t,
    onHoursUpdated,
}: {
    stats: StaffFinanceStatsPayload;
    locale: string;
    t: (key: string, fallback: string) => string;
    onHoursUpdated: () => void | Promise<void>;
}) {
    if (stats.shifts.length === 0) {
        return null;
    }

    return (
        <Card variant="default" padding="lg">
            <SectionHeader
                title={t('finance.staffStats.shiftsPeriod', 'Shift ledger')}
                description={t(
                    'finance.staffStats.shiftsPeriodDesc',
                    'Shift-by-shift money flow, guarantee effects, and client-level entries with quick hour corrections.',
                )}
                badge={<Badge variant="neutral">{stats.shifts.length} {t('finance.staffStats.shifts', 'shifts')}</Badge>}
            />
            <div className="mt-4 space-y-3">
                {stats.shifts.map((shift) => (
                    <StaffFinanceShiftCard
                        key={shift.id}
                        shift={shift}
                        locale={locale}
                        t={t}
                        onHoursUpdated={onHoursUpdated}
                    />
                ))}
            </div>
        </Card>
    );
}
