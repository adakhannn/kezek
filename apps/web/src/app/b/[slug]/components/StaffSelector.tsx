'use client';

import { BookingEmptyState } from '../BookingEmptyState';
import type { Staff } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { RatingDisplay } from '@/components/RatingDisplay';
import { Badge } from '@/components/ui/Badge';
import { formatStaffName } from '@/lib/i18nHelpers';

type StaffSelectorProps = {
    staff: Staff[];
    selectedStaffId: string;
    onSelect: (staffId: string) => void;
    dayStr: string | null;
};

export function StaffSelector({ staff, selectedStaffId, onSelect, dayStr }: StaffSelectorProps) {
    const { t, locale } = useLanguage();

    const formatName = (name: string): string => formatStaffName(name, locale);

    if (!dayStr) {
        return (
            <BookingEmptyState
                type="info"
                title={t('booking.empty.selectDayFirstTitle', 'Сначала нужен день')}
                message={t('booking.empty.selectDayFirst', 'Сначала выберите день, чтобы увидеть реально доступных специалистов.')}
            />
        );
    }

    if (staff.length === 0) {
        return (
            <BookingEmptyState
                type="empty"
                title={t('booking.empty.noStaffTitle', 'На эту дату нет доступных специалистов')}
                message={t('booking.empty.noStaff', 'На выбранную дату в этом филиале нет доступных мастеров. Выберите другой день.')}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-4 py-3">
                <p className="type-caption text-[var(--text-secondary)]">
                    {t('booking.step3.description', 'Сначала можно выбрать конкретного специалиста или доверить системе ближайший свободный слот у любого мастера.')}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                    type="button"
                    data-testid="master-card-any"
                    onClick={() => onSelect('any')}
                    className={[
                        'flex items-center gap-3 rounded-[22px] border p-4 text-sm font-medium transition-all',
                        selectedStaffId === 'any'
                            ? 'border-[var(--accent-primary)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)] text-[var(--accent-primary)] shadow-[var(--shadow-sm)]'
                            : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)]',
                    ].join(' ')}
                >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] text-base font-semibold text-[var(--text-inverse)]">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                        <span className="type-label block text-[var(--text-primary)]" data-testid="master-option-any">
                            {t('booking.step3.anyMaster', 'Любой мастер')}
                        </span>
                        <div className="type-caption mt-1 text-[var(--text-secondary)]">
                            {t('booking.step3.anyMasterHint', 'Покажем ближайший доступный слот без лишнего ручного выбора')}
                        </div>
                    </div>
                </button>

                {staff.map((person) => {
                    const active = person.id === selectedStaffId;

                    return (
                        <button
                            key={person.id}
                            type="button"
                            data-testid="master-card"
                            onClick={() => onSelect(person.id)}
                            className={[
                                'flex items-center gap-3 rounded-[22px] border p-4 text-sm font-medium transition-all',
                                active
                                    ? 'border-[var(--accent-primary)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)] text-[var(--accent-primary)] shadow-[var(--shadow-sm)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)]',
                            ].join(' ')}
                        >
                            {person.avatar_url ? (
                                <img
                                    src={person.avatar_url}
                                    alt={formatName(person.full_name)}
                                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                                    onError={(event) => {
                                        event.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div className="type-label flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-emphasis)] text-[var(--text-muted)]">
                                    {formatName(person.full_name).charAt(0).toUpperCase()}
                                </div>
                            )}

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="type-label truncate text-[var(--text-primary)]" data-testid="master-option">
                                        {formatName(person.full_name)}
                                    </span>
                                    <RatingDisplay score={person.rating_score} t={t} variant="badge" className="ml-2 px-2 py-0.5 [&_svg]:w-3 [&_svg]:h-3" />
                                </div>
                                <div className="mt-2">
                                    <Badge variant={active ? 'accent' : 'neutral'}>
                                        {active
                                            ? t('booking.step3.selectedMaster', 'Выбран для визита')
                                            : t('booking.step3.availableMaster', 'Можно выбрать')}
                                    </Badge>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
