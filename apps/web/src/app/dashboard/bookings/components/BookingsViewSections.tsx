'use client';

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import type { BookingItem as BookingViewItem, BranchRow as BookingViewBranchRow, StaffRow as BookingViewStaffRow, TabKey as BookingViewTabKey } from './bookingsViewTypes';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { BookingCard } from '@/components/dashboard';
import { Tabs } from '@/components/ui/Tabs';
import { logError } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';
import { todayStringInTz } from '@/lib/time';


export function BookingsViewTabs({
    value,
    onChange,
}: {
    value: BookingViewTabKey;
    onChange: (value: BookingViewTabKey) => void;
}) {
    const { t } = useLanguage();

    return (
        <Tabs
            value={value}
            onValueChange={(nextValue) => onChange(nextValue as BookingViewTabKey)}
            stretch
            className="w-full"
            items={[
                { key: 'calendar', label: t('bookings.tabs.calendar', 'Календарь') },
                { key: 'list', label: t('bookings.tabs.list', 'Список') },
                { key: 'desk', label: t('bookings.tabs.desk', 'QuickDesk') },
            ]}
        />
    );
}

function hourRange(start: number, end: number) {
    const hours: number[] = [];
    for (let hour = start; hour <= end; hour += 1) {
        hours.push(hour);
    }
    return hours;
}

function minutesFromMidnight(date: Date) {
    return date.getHours() * 60 + date.getMinutes();
}

function cellKey(staffId: string, hour: number) {
    return `${staffId}-${hour}`;
}

function BookingPill({
    id,
    startISO,
    endISO,
    status,
    timezone,
    title,
}: {
    id: string;
    startISO: string;
    endISO: string;
    status: BookingViewItem['status'];
    timezone: string;
    title?: string;
}) {
    return (
        <BookingCard
            id={id}
            startISO={startISO}
            endISO={endISO}
            status={status}
            timezone={timezone}
            href={`/booking/${id}`}
            title={title}
        />
    );
}

export function CalendarDaySection({
    bizId,
    staff,
    branches,
    timezone,
}: {
    bizId: string;
    staff: BookingViewStaffRow[];
    branches: BookingViewBranchRow[];
    timezone: string;
}) {
    const { t, locale } = useLanguage();
    const [date, setDate] = useState<string>(() => todayStringInTz(timezone));
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
    const [items, setItems] = useState<
        { id: string; staff_id: string; start_at: string; end_at: string; status: BookingViewItem['status']; servicesSummary?: string }[]
    >([]);

    const filteredStaff = useMemo(() => {
        if (selectedBranchId === 'all') return staff;
        return staff.filter((member) => member.branch_id === selectedBranchId);
    }, [staff, selectedBranchId]);

    function exportCsv() {
        const rows = items.map((item) => ({
            id: item.id,
            staff_id: item.staff_id,
            start_at: formatInTimeZone(new Date(item.start_at), timezone, 'yyyy-MM-dd HH:mm'),
            end_at: formatInTimeZone(new Date(item.end_at), timezone, 'yyyy-MM-dd HH:mm'),
            status: item.status,
        }));
        const csv = `id,staff_id,start_at,end_at,status\n${rows.map((row) => `${row.id},${row.staff_id},${row.start_at},${row.end_at},${row.status}`).join('\n')}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bookings-${date}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    useEffect(() => {
        let ignore = false;

        (async () => {
            const startOfDay = fromZonedTime(`${date}T00:00:00`, timezone);
            const endOfDay = fromZonedTime(`${date}T23:59:59.999`, timezone);
            const startDay = startOfDay.toISOString();
            const endDay = endOfDay.toISOString();

            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    id,
                    staff_id,
                    start_at,
                    end_at,
                    status,
                    booking_services (
                        duration_min,
                        service:services (name_ru, name_ky, name_en)
                    )
                `)
                .eq('biz_id', bizId)
                .neq('status', 'cancelled')
                .gte('start_at', startDay)
                .lte('start_at', endDay)
                .order('start_at', { ascending: true });

            if (ignore) return;
            if (error) {
                logError('CalendarDaySection', 'Error loading bookings', error);
                setItems([]);
                return;
            }

            type CalendarBookingRow = {
                id: string | number;
                staff_id: string | number;
                start_at: string | Date;
                end_at: string | Date;
                status: BookingViewItem['status'];
                booking_services?: {
                    duration_min: number | null;
                    service?: { name_ru?: string; name_ky?: string | null; name_en?: string | null } | null;
                }[] | null;
            };

            const rows = (data ?? []) as CalendarBookingRow[];
            const mapped = rows.map((row) => {
                const rawServices = Array.isArray(row.booking_services) ? row.booking_services : [];
                if (rawServices.length === 0) {
                    return {
                        id: String(row.id),
                        staff_id: String(row.staff_id),
                        start_at: String(row.start_at),
                        end_at: String(row.end_at),
                        status: row.status,
                        servicesSummary: undefined,
                    };
                }

                const parts: string[] = [];
                let totalDuration = 0;
                for (const serviceRow of rawServices) {
                    const service = serviceRow.service || {};
                    const name =
                        (locale === 'ky' && service.name_ky) ||
                        (locale === 'en' && service.name_en) ||
                        service.name_ru ||
                        '';
                    const duration = typeof serviceRow.duration_min === 'number' ? serviceRow.duration_min : 0;
                    totalDuration += duration;
                    const label = name
                        ? `${name} (${duration} ${t('booking.duration.min', 'мин')})`
                        : `${duration} ${t('booking.duration.min', 'мин')}`;
                    parts.push(label);
                }

                const summaryBase = parts.join('; ');
                const summaryTotal =
                    totalDuration > 0
                        ? ` — ${t('cabinet.bookings.card.totalDuration', 'Всего:')} ${totalDuration} ${t('booking.duration.min', 'мин')}`
                        : '';

                return {
                    id: String(row.id),
                    staff_id: String(row.staff_id),
                    start_at: String(row.start_at),
                    end_at: String(row.end_at),
                    status: row.status,
                    servicesSummary: `${summaryBase}${summaryTotal}`,
                };
            });

            setItems(mapped);
        })();

        return () => {
            ignore = true;
        };
    }, [bizId, date, locale, t, timezone]);

    const hours = hourRange(9, 21);
    const bookingsByStaff = useMemo(() => {
        const map = new Map<string, { id: string; staff_id: string; start_at: string; end_at: string; status: BookingViewItem['status']; servicesSummary?: string }[]>();
        for (const member of filteredStaff) {
            map.set(member.id, []);
        }
        for (const item of items) {
            if (!map.has(item.staff_id)) {
                map.set(item.staff_id, []);
            }
            map.get(item.staff_id)!.push(item);
        }
        return map;
    }, [filteredStaff, items]);

    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('bookings.calendar.title', 'Календарь на день')}</h2>
                <div className="flex items-center gap-3 flex-wrap">
                    {branches.length > 1 && (
                        <select
                            className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm"
                            value={selectedBranchId}
                            onChange={(event) => setSelectedBranchId(event.target.value)}
                        >
                            <option value="all">{t('bookings.calendar.allBranches', 'Все филиалы')}</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                </option>
                            ))}
                        </select>
                    )}
                    <input
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                    />
                    <button
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-sm flex items-center gap-2"
                        onClick={exportCsv}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {t('bookings.calendar.exportCsv', 'Экспорт CSV')}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="sticky top-0 z-[96]">
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4 w-24">{t('bookings.calendar.time', 'Время')}</th>
                            {filteredStaff.length === 0 ? (
                                <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">{t('bookings.calendar.noStaff', 'Нет мастеров')}</th>
                            ) : (
                                filteredStaff.map((member) => (
                                    <th key={member.id} className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">
                                        {member.full_name}
                                    </th>
                                ))
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {hours.map((hour) => (
                            <tr key={hour} className="align-top">
                                <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-400">{`${String(hour).padStart(2, '0')}:00`}</td>
                                {filteredStaff.length === 0 ? (
                                    <td className="p-4 text-sm text-gray-400 dark:text-gray-500">{t('bookings.calendar.noStaffInBranch', '—')}</td>
                                ) : (
                                    filteredStaff.map((member) => {
                                        const events = (bookingsByStaff.get(member.id) ?? []).filter(
                                            (event) => Math.floor(minutesFromMidnight(new Date(event.start_at)) / 60) === hour,
                                        );

                                        return (
                                            <td key={cellKey(member.id, hour)} className="p-4">
                                                {events.length === 0 && <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                                                {events.map((event) => (
                                                    <div key={event.id} className="mb-1">
                                                        <BookingPill
                                                            id={event.id}
                                                            startISO={event.start_at}
                                                            endISO={event.end_at}
                                                            status={event.status}
                                                            timezone={timezone}
                                                            title={event.servicesSummary}
                                                        />
                                                    </div>
                                                ))}
                                            </td>
                                        );
                                    })
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
