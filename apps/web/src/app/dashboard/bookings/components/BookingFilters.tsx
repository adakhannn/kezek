'use client';

import { FilterPreset, FilterPresets } from './FilterPresets';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from '@/components/ui/SectionHeader';

type BranchRow = { id: string; name: string };

type BookingFiltersProps = {
    statusFilter: string;
    branchFilter: string;
    searchQuery: string;
    branches: BranchRow[];
    onStatusChange: (status: string) => void;
    onBranchChange: (branch: string) => void;
    onSearchChange: (query: string) => void;
    onRefresh: () => void;
    isLoading: boolean;
    activePreset?: FilterPreset;
    onPresetChange?: (preset: FilterPreset) => void;
    timezone: string;
    currentStaffId?: string | null;
    hasStaffAccess?: boolean;
    visibleCount: number;
    totalCount: number;
};

export function BookingFilters({
    statusFilter,
    branchFilter,
    searchQuery,
    branches,
    onStatusChange,
    onBranchChange,
    onSearchChange,
    onRefresh,
    isLoading,
    activePreset,
    onPresetChange,
    timezone,
    currentStaffId,
    hasStaffAccess,
    visibleCount,
    totalCount,
}: BookingFiltersProps) {
    const { t } = useLanguage();

    const modeLabel = activePreset === 'today'
        ? t('bookings.workspace.mode.today', 'Фокус на сегодня')
        : activePreset === 'myStaff'
          ? t('bookings.workspace.mode.myStaff', 'Фокус на мастере')
          : searchQuery.trim()
            ? t('bookings.workspace.mode.search', 'Режим поиска')
            : t('bookings.workspace.mode.history', 'Общий список и история');

    return (
        <div className="space-y-4">
            <SectionHeader
                title={t('bookings.list.title', 'Брони')}
                description={t(
                    'bookings.workspace.description',
                    'Быстро переключайтесь между сегодняшней операционной работой, поиском по истории и ручной обработкой статусов.',
                )}
                badge={
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                        <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                        {modeLabel}
                    </span>
                }
                action={
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        isLoading={isLoading}
                        leadingIcon={
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        }
                    >
                        {t('bookings.list.refresh', 'Обновить')}
                    </Button>
                }
            />

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(180px,0.45fr))_auto]">
                <Input
                    label={t('bookings.filters.search', 'Поиск')}
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={t('bookings.filters.searchPlaceholder', 'Клиент, телефон, мастер, ID или услуга')}
                    helperText={t('bookings.filters.searchHint', 'Поиск помогает быстро перейти из операционного режима к истории и конкретной записи')}
                />

                <div className="space-y-1.5">
                    <label className="type-caption block font-medium text-[var(--text-secondary)]">
                        {t('bookings.filters.status', 'Статус')}
                    </label>
                    <select
                        value={statusFilter}
                        onChange={(event) => onStatusChange(event.target.value)}
                        className="motion-interactive min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:outline-none"
                    >
                        <option value="all">{t('bookings.filters.statusAll', 'Все активные')}</option>
                        <option value="hold">{t('bookings.status.hold', 'Ожидает')}</option>
                        <option value="confirmed">{t('bookings.status.confirmed', 'Подтверждена')}</option>
                        <option value="paid">{t('bookings.status.paid', 'Оплачена')}</option>
                        <option value="cancelled">{t('bookings.status.cancelled', 'Отменена')}</option>
                        <option value="no_show">{t('bookings.status.no_show', 'Не пришел')}</option>
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="type-caption block font-medium text-[var(--text-secondary)]">
                        {t('bookings.filters.branch', 'Филиал')}
                    </label>
                    <select
                        value={branchFilter}
                        onChange={(event) => onBranchChange(event.target.value)}
                        className="motion-interactive min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:outline-none"
                    >
                        <option value="all">{t('bookings.calendar.allBranches', 'Все филиалы')}</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-3">
                    <p className="type-label text-[var(--text-secondary)]">{t('bookings.workspace.results', 'Результат')}</p>
                    <p className="type-section-title mt-1 text-[var(--text-primary)]">{visibleCount}</p>
                    <p className="type-caption mt-1 text-[var(--text-muted)]">
                        {t('bookings.workspace.resultsHint', 'из')} {totalCount}
                    </p>
                </div>
            </div>

            {onPresetChange ? (
                <FilterPresets
                    activePreset={activePreset || null}
                    onPresetChange={onPresetChange}
                    timezone={timezone}
                    currentStaffId={currentStaffId}
                    hasStaffAccess={hasStaffAccess}
                />
            ) : null}
        </div>
    );
}
