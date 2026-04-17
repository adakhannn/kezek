'use client';

import { useMemo, useState } from 'react';

import { BookingsViewTabs, CalendarDaySection } from './components/BookingsViewSections';
import { DashboardBookingsListSection } from './components/DashboardBookingsListSection';
import { QuickDesk } from './components/QuickDesk';
import type { BookingItem, BranchRow, ServiceRow, StaffRow, TabKey } from './components/bookingsViewTypes';
import { notify } from './notify';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { PageHeader } from '@/components/ui/PageHeader';
import { getBusinessTimezone } from '@/lib/time';

export default function AdminBookingsView({
    bizId,
    businessTz,
    services,
    staff,
    branches,
    initial,
}: {
    bizId: string;
    businessTz?: string | null;
    services: ServiceRow[];
    staff: StaffRow[];
    branches: BranchRow[];
    initial: BookingItem[];
}) {
    const { t } = useLanguage();
    const [tab, setTab] = useState<TabKey>('calendar');
    const timezone = getBusinessTimezone(businessTz);

    const tabMeta = useMemo(() => {
        if (tab === 'desk') {
            return {
                title: t('bookings.workspace.tab.quickdesk', 'QuickDesk'),
                description: t(
                    'bookings.workspace.tab.quickdeskDesc',
                    'Операторский режим для быстрой записи у стойки: клиент, услуга, мастер и ближайший слот без лишних переходов.',
                ),
                chip: t('bookings.workspace.mode.operations', 'Операционный режим'),
            };
        }

        if (tab === 'list') {
            return {
                title: t('bookings.workspace.tab.list', 'Список и история'),
                description: t(
                    'bookings.workspace.tab.listDesc',
                    'Поиск, история, статусы и ручная обработка бронирований в одном рабочем списке.',
                ),
                chip: t('bookings.workspace.mode.searchHistory', 'Поиск и история'),
            };
        }

        return {
            title: t('bookings.workspace.tab.calendar', 'Сегодня и календарь дня'),
            description: t(
                'bookings.workspace.tab.calendarDesc',
                'Дневной обзор по мастерам и времени, чтобы команда быстро видела загрузку и свободные окна.',
            ),
            chip: t('bookings.workspace.mode.todayCalendar', 'Сегодня'),
        };
    }, [tab, t]);

    return (
        <div className="space-y-5 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8 xl:px-8">
            <section className="rounded-[30px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-md)] sm:p-5 lg:p-6">
                <PageHeader
                    eyebrow={
                        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                            {tabMeta.chip}
                        </span>
                    }
                    title={t('bookings.title', 'Брони')}
                    description={t(
                        'bookings.subtitle',
                        'Единое операционное рабочее место для сегодняшнего потока, истории бронирований и быстрой записи клиентов.',
                    )}
                    meta={
                        <div className="grid gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-3">
                            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-3">
                                <p className="type-label text-[var(--text-secondary)]">Today</p>
                                <p className="type-caption mt-1">{t('bookings.workspace.summary.today', 'Откройте календарь, чтобы увидеть смены и ближайшие окна по мастерам.')}</p>
                            </div>
                            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-3">
                                <p className="type-label text-[var(--text-secondary)]">History</p>
                                <p className="type-caption mt-1">{t('bookings.workspace.summary.history', 'Список помогает быстро искать прошлые и текущие бронирования по клиенту, ID и статусу.')}</p>
                            </div>
                            <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-3">
                                <p className="type-label text-[var(--text-secondary)]">QuickDesk</p>
                                <p className="type-caption mt-1">{t('bookings.workspace.summary.quickdesk', 'Режим стойки сокращает путь до новой записи, когда клиент уже перед администратором.')}</p>
                            </div>
                        </div>
                    }
                />

                <div className="mt-5">
                    <BookingsViewTabs value={tab} onChange={setTab} />
                </div>

                <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-3">
                    <h2 className="type-section-title text-[var(--text-primary)]">{tabMeta.title}</h2>
                    <p className="type-body mt-1 text-[var(--text-muted)]">{tabMeta.description}</p>
                </div>
            </section>

            {tab === 'calendar' && (
                <CalendarDaySection bizId={bizId} staff={staff} branches={branches} timezone={timezone} />
            )}
            {tab === 'list' && (
                <DashboardBookingsListSection
                    bizId={bizId}
                    initial={initial}
                    branches={branches}
                    timezone={timezone}
                    notify={notify}
                />
            )}
            {tab === 'desk' && (
                <QuickDesk
                    bizId={bizId}
                    services={services}
                    staff={staff}
                    branches={branches}
                    onTabChange={setTab}
                    timezone={timezone}
                />
            )}
        </div>
    );
}
