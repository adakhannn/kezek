'use client';

import { addDays, addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

type ServiceRow = { id: string; name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number; branch_id: string };
type StaffRow   = { id: string; full_name: string; branch_id: string };
type BranchRow  = { id: string; name: string };

type BookingItem = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';
    start_at: string;
    end_at: string;
    services?: { name_ru: string; name_ky?: string | null }[];
    staff?: { full_name: string }[];
};

type RpcSlot = { staff_id: string; branch_id: string; start_at: string; end_at: string };

// ---------------- utils/notify ----------------
async function notify(type: 'hold' | 'confirm' | 'cancel', bookingId: string) {
    try {
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type, booking_id: bookingId }),
        });
    } catch (e) {
        console.error('notify failed', type, bookingId, e);
    }
}

// ---------------- Tabs ----------------
type TabKey = 'calendar' | 'list' | 'desk';
function Tabs({ value, onChange }: { value: TabKey; onChange: (v: TabKey) => void }) {
    const { t } = useLanguage();
    const btn = (key: TabKey, labelKey: string) => (
        <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                value === key
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
        >
            {t(labelKey, '')}
        </button>
    );
    return <div className="flex gap-1 sm:gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">{btn('calendar', 'bookings.tabs.calendar')}{btn('list', 'bookings.tabs.list')}{btn('desk', 'bookings.tabs.desk')}</div>;
}

// ---------------- Calendar ----------------
function hourRange(start: number, end: number) { const a: number[] = []; for (let h = start; h <= end; h++) a.push(h); return a; }
function minutesFromMidnight(d: Date) { return d.getHours() * 60 + d.getMinutes(); }
function cellKey(staffId: string, hour: number) { return `${staffId}-${hour}`; }
function BookingPill({ id, startISO, endISO, status }: { id: string; startISO: string; endISO: string; status: BookingItem['status'] }) {
    const { t } = useLanguage();
    const start = new Date(startISO);
    const end   = new Date(endISO);
    const label = `${formatInTimeZone(start, TZ, 'HH:mm')}–${formatInTimeZone(end, TZ, 'HH:mm')}`;
    const statusStyles = {
        hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800',
        confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800',
        paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800',
        cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-700 line-through',
        no_show: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-800',
    };
    return (
        <Link href={`/booking/${id}`} className={`inline-block text-xs px-2 py-1 border rounded-lg font-medium ${statusStyles[status]} hover:opacity-90 transition-opacity`} title={`${t('bookings.calendar.openBooking', 'Открыть бронь')} #${id.slice(0, 8)}`}>
            {label}
        </Link>
    );
}

function CalendarDay({ bizId, staff, branches }: { bizId: string; staff: StaffRow[]; branches: BranchRow[] }) {
    const { t } = useLanguage();
    const [date, setDate] = useState<string>(() => formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
    const [items, setItems] = useState<{ id: string; staff_id: string; start_at: string; end_at: string; status: BookingItem['status'] }[]>([]);
    
    // Фильтруем мастеров по филиалу
    const filteredStaff = useMemo(() => {
        if (selectedBranchId === 'all') return staff;
        return staff.filter(s => s.branch_id === selectedBranchId);
    }, [staff, selectedBranchId]);

    function exportCsv() {
        const rows = items.map(r => ({
            id: r.id,
            staff_id: r.staff_id,
            start_at: formatInTimeZone(new Date(r.start_at), TZ, 'yyyy-MM-dd HH:mm'),
            end_at:   formatInTimeZone(new Date(r.end_at), TZ, 'yyyy-MM-dd HH:mm'),
            status:   r.status,
        }));
        const csv = `id,staff_id,start_at,end_at,status\n${rows.map(r => `${r.id},${r.staff_id},${r.start_at},${r.end_at},${r.status}`).join('\n')}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `bookings-${date}.csv`; a.click(); URL.revokeObjectURL(url);
    }

    useEffect(() => {
        let ignore = false;
        (async () => {
            const startDay = `${date}T00:00:00+06:00`;
            const endDay   = `${date}T23:59:59+06:00`;
            const { data, error } = await supabase
                .from('bookings')
                .select('id,staff_id,start_at,end_at,status')
                .eq('biz_id', bizId)
                .neq('status', 'cancelled')
                .gte('start_at', startDay)
                .lte('start_at', endDay)
                .order('start_at', { ascending: true });
            if (ignore) return;
            if (error) { console.error(error); setItems([]); return; }
            setItems((data ?? []).map(r => ({
                id: String(r.id),
                staff_id: String(r.staff_id),
                start_at: String(r.start_at),
                end_at: String(r.end_at),
                status: r.status as BookingItem['status'],
            })));
        })();
        return () => { ignore = true; };
    }, [bizId, date]);

    const hours = hourRange(9, 21);
    const byStaff = useMemo(() => {
        const map = new Map<string, { id: string; staff_id: string; start_at: string; end_at: string; status: BookingItem['status'] }[]>();
        for (const s of filteredStaff) map.set(s.id, []);
        for (const it of items) { if (!map.has(it.staff_id)) map.set(it.staff_id, []); map.get(it.staff_id)!.push(it); }
        return map;
    }, [items, filteredStaff]);

    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('bookings.calendar.title', 'Календарь на день')}</h2>
                <div className="flex items-center gap-3 flex-wrap">
                    {branches.length > 1 && (
                        <select 
                            className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm"
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(e.target.value)}
                        >
                            <option value="all">{t('bookings.calendar.allBranches', 'Все филиалы')}</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    )}
                    <input className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    <button className="px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 text-sm flex items-center gap-2" onClick={exportCsv}>
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
                            filteredStaff.map(s => (<th key={s.id} className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">{s.full_name}</th>))
                        )}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {hours.map(h => (
                        <tr key={h} className="align-top">
                            <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-400">{`${String(h).padStart(2, '0')}:00`}</td>
                            {filteredStaff.length === 0 ? (
                                <td className="p-4 text-sm text-gray-400 dark:text-gray-500">{t('bookings.calendar.noStaffInBranch', '—')}</td>
                            ) : (
                                filteredStaff.map(s => {
                                const events = (byStaff.get(s.id) ?? []).filter(ev => Math.floor(minutesFromMidnight(new Date(ev.start_at)) / 60) === h);
                                return (
                                    <td key={cellKey(s.id, h)} className="p-4">
                                        {events.length === 0 && <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                                        {events.map(ev => (
                                            <div key={ev.id} className="mb-1">
                                                <BookingPill id={ev.id} startISO={ev.start_at} endISO={ev.end_at} status={ev.status} />
                                            </div>
                                        ))}
                                    </td>
                                );
                            }))}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-wrap gap-4 text-xs pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="inline-block w-3 h-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800" />
                    {t('bookings.status.hold', 'hold')}
                </span>
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="inline-block w-3 h-3 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-800" />
                    {t('bookings.status.confirmed', 'confirmed')}
                </span>
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="inline-block w-3 h-3 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-800" />
                    {t('bookings.status.paid', 'paid / пришел')}
                </span>
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800" />
                    {t('bookings.status.noShow', 'no_show / не пришел')}
                </span>
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="inline-block w-3 h-3 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700" />
                    {t('bookings.status.cancelled', 'cancelled')}
                </span>
            </div>
        </section>
    );
}

// ---------------- List ----------------
function ListTable({ bizId, initial, branches }: { bizId: string; initial: BookingItem[]; branches: BranchRow[] }) {
    const { t, locale } = useLanguage();
    const [list, setList] = useState<BookingItem[]>(initial);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Функция для получения названия услуги в зависимости от языка
    const getServiceName = (service: { name_ru: string; name_ky?: string | null } | undefined): string => {
        if (!service) return '';
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        return service.name_ru;
    };

    async function refresh() {
        // Загружаем прошедшие брони (для отметки посещения) и будущие
        let query = supabase
            .from('bookings')
            .select('id,status,start_at,end_at,branch_id,services(name_ru,name_ky),staff(full_name),client_name,client_phone')
            .eq('biz_id', bizId);
        
        if (statusFilter !== 'all') {
            if (statusFilter === 'active') {
                query = query.in('status', ['hold', 'confirmed']);
            } else {
                query = query.eq('status', statusFilter);
            }
        } else {
            query = query.neq('status', 'cancelled');
        }
        
        if (branchFilter !== 'all') {
            query = query.eq('branch_id', branchFilter);
        }
        
        const { data } = await query
            .order('start_at', { ascending: false })
            .limit(100);
        
        // Фильтруем по поисковому запросу на клиенте
        let filtered = data || [];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(b => {
                const service = Array.isArray(b.services) ? b.services[0] : b.services;
                const master = Array.isArray(b.staff) ? b.staff[0] : b.staff;
                return (
                    (service?.name_ru?.toLowerCase().includes(q)) ||
                    (master?.full_name?.toLowerCase().includes(q)) ||
                    (b.client_name?.toLowerCase().includes(q)) ||
                    (b.client_phone?.includes(q)) ||
                    (String(b.id).toLowerCase().includes(q))
                );
            });
        }
        
        setList(filtered);
    }
    
    useEffect(() => {
        refresh();
    }, [statusFilter, branchFilter]);

    async function confirm(id: string) {
        const { error } = await supabase.rpc('confirm_booking', { p_booking_id: id });
        if (error) return alert(error.message);
        await notify('confirm', id);
        await refresh();
    }

    async function cancel(id: string) {
        // Пытаемся отменить через RPC
        const { error } = await supabase.rpc('cancel_booking', { p_booking_id: id });
        
        // Если ошибка связана с назначением сотрудника, обновляем статус напрямую
        if (error) {
            const errorMsg = error.message.toLowerCase();
            if (errorMsg.includes('not assigned to branch') || errorMsg.includes('staff')) {
                // Обновляем статус напрямую, минуя проверку назначения
                const { error: updateError } = await supabase
                    .from('bookings')
                    .update({ status: 'cancelled' })
                    .eq('id', id);
                
                if (updateError) {
                    return alert(updateError.message);
                }
            } else {
                return alert(error.message);
            }
        }
        
        await notify('cancel', id);
        await refresh();
    }

    async function markAttendance(id: string, attended: boolean) {
        const res = await fetch(`/api/bookings/${id}/mark-attendance`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ attended }),
        });
        const j = await res.json();
        if (!j.ok) return alert(j.error || t('bookings.list.markAttendanceError', 'Не удалось обновить статус'));
        await refresh();
    }

    const statusColors = {
        hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
        no_show: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };

    return (
        <section className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{t('bookings.list.title', 'Последние 30 броней')}</h2>
                <button className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 flex items-center justify-center gap-2" onClick={refresh}>
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="hidden sm:inline">{t('bookings.list.refresh', 'Обновить')}</span>
                    <span className="sm:hidden">{t('bookings.list.refresh', 'Обновить')}</span>
                </button>
            </div>
            
            {/* Фильтры и поиск */}
            <div className="flex flex-col gap-2 sm:gap-3">
                <input
                    type="text"
                    placeholder={t('bookings.list.searchPlaceholder', 'Поиск: услуга, мастер, клиент, ID...')}
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        // Debounce будет через useEffect
                    }}
                    className="w-full px-3 sm:px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                />
                <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
                    {branches.length > 1 && (
                        <select
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="flex-1 px-3 sm:px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                        >
                            <option value="all">{t('bookings.list.allBranches', 'Все филиалы')}</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    )}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="flex-1 px-3 sm:px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                    >
                        <option value="all">{t('bookings.list.allStatuses', 'Все статусы')}</option>
                        <option value="active">{t('bookings.list.active', 'Активные')}</option>
                        <option value="hold">{t('bookings.list.hold', 'В ожидании')}</option>
                        <option value="confirmed">{t('bookings.list.confirmed', 'Подтвержденные')}</option>
                        <option value="paid">{t('bookings.list.paid', 'Оплаченные')}</option>
                        <option value="no_show">{t('bookings.list.noShow', 'Не пришли')}</option>
                    </select>
                </div>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full">
                    <thead className="sticky top-0 z-[96]">
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">#</th>
                        <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">{t('bookings.list.service', 'Услуга')}</th>
                        <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">{t('bookings.list.master', 'Мастер')}</th>
                        <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">{t('bookings.list.start', 'Начало')}</th>
                        <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">{t('bookings.list.status', 'Статус')}</th>
                        <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 lg:p-4">{t('bookings.list.actions', 'Действия')}</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {list.map(b => {
                        const service = Array.isArray(b.services) ? b.services[0] : b.services;
                        const master  = Array.isArray(b.staff)    ? b.staff[0]    : b.staff;
                        const isPast = new Date(b.start_at) < new Date();
                        const canMarkAttendance = isPast && b.status !== 'cancelled' && b.status !== 'no_show' && b.status !== 'paid';
                        
                        return (
                            <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-3 lg:p-4 text-sm font-mono text-gray-600 dark:text-gray-400">{String(b.id).slice(0, 8)}</td>
                                <td className="p-3 lg:p-4 text-sm font-medium text-gray-900 dark:text-gray-100">{getServiceName(service)}</td>
                                <td className="p-3 lg:p-4 text-sm text-gray-700 dark:text-gray-300">{master?.full_name}</td>
                                <td className="p-3 lg:p-4 text-sm text-gray-700 dark:text-gray-300">{formatInTimeZone(new Date(b.start_at), TZ, 'dd.MM.yyyy HH:mm')}</td>
                                <td className="p-3 lg:p-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[b.status as keyof typeof statusColors] || statusColors.cancelled}`}>
                                        {b.status === 'no_show' ? t('bookings.status.noShowShort', 'не пришел') : b.status === 'paid' && isPast ? t('bookings.status.attended', 'пришел') : t(`bookings.status.${b.status}`, b.status)}
                                    </span>
                                </td>
                                <td className="p-3 lg:p-4">
                                    <div className="flex gap-2 flex-wrap">
                                        {canMarkAttendance && (
                                            <>
                                                <button 
                                                    className="px-2.5 py-1 text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-all duration-200" 
                                                    onClick={() => markAttendance(b.id, true)}
                                                >
                                                    {t('bookings.actions.attended', 'Пришел')}
                                                </button>
                                                <button 
                                                    className="px-2.5 py-1 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200" 
                                                    onClick={() => markAttendance(b.id, false)}
                                                >
                                                    {t('bookings.actions.noShow', 'Не пришел')}
                                                </button>
                                            </>
                                        )}
                                        {!isPast && b.status !== 'cancelled' && (
                                            <button className="px-2.5 py-1 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200" onClick={() => cancel(b.id)}>
                                                {t('bookings.actions.cancel', 'Отменить')}
                                            </button>
                                        )}
                                        {!isPast && b.status === 'hold' && (
                                            <button className="px-2.5 py-1 text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-all duration-200" onClick={() => confirm(b.id)}>
                                                {t('bookings.actions.confirm', 'Подтвердить')}
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {list.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p className="text-sm">{t('bookings.list.empty', 'Нет броней')}</p>
                    </div>
                ) : (
                    list.map(b => {
                        const service = Array.isArray(b.services) ? b.services[0] : b.services;
                        const master  = Array.isArray(b.staff)    ? b.staff[0]    : b.staff;
                        const isPast = new Date(b.start_at) < new Date();
                        const canMarkAttendance = isPast && b.status !== 'cancelled' && b.status !== 'no_show' && b.status !== 'paid';
                        
                        return (
                            <div key={b.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2.5">
                                {/* Header with ID and Status */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">#{String(b.id).slice(0, 8)}</span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[b.status as keyof typeof statusColors] || statusColors.cancelled}`}>
                                                {b.status === 'no_show' ? t('bookings.status.noShowShort', 'не пришел') : b.status === 'paid' && isPast ? t('bookings.status.attended', 'пришел') : t(`bookings.status.${b.status}`, b.status)}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{getServiceName(service)}</h3>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span className="truncate">{master?.full_name || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span>{formatInTimeZone(new Date(b.start_at), TZ, 'dd.MM.yyyy HH:mm')}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                {(canMarkAttendance || (!isPast && b.status !== 'cancelled') || (!isPast && b.status === 'hold')) && (
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                        {canMarkAttendance && (
                                            <>
                                                <button 
                                                    className="flex-1 min-w-[100px] px-2.5 py-1.5 text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-all duration-200" 
                                                    onClick={() => markAttendance(b.id, true)}
                                                >
                                                    {t('bookings.actions.attended', 'Пришел')}
                                                </button>
                                                <button 
                                                    className="flex-1 min-w-[100px] px-2.5 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200" 
                                                    onClick={() => markAttendance(b.id, false)}
                                                >
                                                    {t('bookings.actions.noShow', 'Не пришел')}
                                                </button>
                                            </>
                                        )}
                                        {!isPast && b.status !== 'cancelled' && (
                                            <button className="flex-1 min-w-[100px] px-2.5 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200" onClick={() => cancel(b.id)}>
                                                {t('bookings.actions.cancel', 'Отменить')}
                                            </button>
                                        )}
                                        {!isPast && b.status === 'hold' && (
                                            <button className="flex-1 min-w-[100px] px-2.5 py-1.5 text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-all duration-200" onClick={() => confirm(b.id)}>
                                                {t('bookings.actions.confirm', 'Подтвердить')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
}

// ---------------- Quick Desk ----------------
function QuickDesk({
                       bizId, services, staff, branches,
                   }: {
    bizId: string;
    services: ServiceRow[];
    staff: StaffRow[];
    branches: BranchRow[];
}) {
    const { t, locale } = useLanguage();
    // выбранный филиал (начинаем с пустого, как в публичной версии)
    const [branchId, setBranchId] = useState<string>('');

    // Функция для получения названия услуги в зависимости от языка
    const getServiceName = (service: ServiceRow): string => {
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        if (locale === 'en' && service.name_en) return service.name_en;
        return service.name_ru;
    };

    // фильтры по филиалу
    const servicesByBranch = useMemo(
        () => branchId ? services.filter(s => s.branch_id === branchId) : [],
        [services, branchId],
    );
    const staffByBranch = useMemo(
        () => branchId ? staff.filter(s => s.branch_id === branchId) : [],
        [staff, branchId],
    );

    // выбранные значения (начинаем с пустых, как в публичной версии)
    const [serviceId, setServiceId]   = useState<string>('');
    const [staffId, setStaffId]       = useState<string>('');
    const [date, setDate]             = useState<string>(() => formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));

    // слоты
    const [slots, setSlots] = useState<RpcSlot[]>([]);
    const [slotStartISO, setSlotStartISO] = useState<string>('');
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // ====== Клиент ======
    type ClientMode = 'none' | 'existing';
    const [clientMode, setClientMode] = useState<ClientMode>('none');

    // существующий клиент (поиск)
    const [searchQ, setSearchQ] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchErr, setSearchErr] = useState<string | null>(null);
    const [foundUsers, setFoundUsers] = useState<{id:string; full_name:string; email:string|null; phone:string|null}[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    async function searchUsers(q: string) {
        setSearchLoading(true); setSearchErr(null);
        try {
            const res = await fetch('/api/users/search', {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({ q }),
            });
            const j = await res.json();
            if (!j.ok) throw new Error(j.error || 'SEARCH_FAILED');
            setFoundUsers(j.items ?? []);
        } catch (e: unknown) {
            setSearchErr(e instanceof Error ? e.message : String(e));
            setFoundUsers([]);
        } finally {
            setSearchLoading(false);
        }
    }

    // при смене филиала — сбрасываем выбор и слоты (как в публичной версии)
    useEffect(() => {
        setServiceId('');
        setStaffId('');
        setSlots([]);
        setSlotStartISO('');
    }, [branchId]);

    // загрузка слотов
    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!branchId || !serviceId || !date) { setSlots([]); setSlotStartISO(''); setSlotsLoading(false); return; }
            setSlotsLoading(true);
            const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
                p_biz_id: bizId,
                p_service_id: serviceId,
                p_day: date,
                p_per_staff: 400,
                p_step_min: 15,
            });
            if (ignore) return;
            if (error) {
                console.error('[QuickDesk] get_free_slots_service_day_v2 error:', error.message || error);
                setSlots([]); setSlotStartISO(''); setSlotsLoading(false);
                return;
            }
            const raw = (data || []) as RpcSlot[];
            const now = new Date();
            const minTime = addMinutes(now, 30); // минимум через 30 минут от текущего времени
            // Фильтруем по филиалу, мастеру (если выбран) и времени
            const filtered = raw
                .filter(s => s.branch_id === branchId)
                .filter(s => staffId ? s.staff_id === staffId : true)
                .filter(s => new Date(s.start_at) > minTime);

            // dedupe по start_at
            const uniq = Array.from(new Map(filtered.map(s => [s.start_at, s])).values());
            setSlots(uniq);
            setSlotStartISO(prev => (prev && uniq.some(u => u.start_at === prev)) ? prev : (uniq[0]?.start_at || ''));
            setSlotsLoading(false);
        })();
        return () => { ignore = true; };
    }, [bizId, serviceId, staffId, date, branchId]);

    // Debounce для поиска клиентов
    useEffect(() => {
        if (!searchQ.trim() || clientMode !== 'existing') {
            setFoundUsers([]);
            return;
        }
        const timer = setTimeout(() => {
            searchUsers(searchQ);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQ, clientMode, searchUsers]);

    async function quickCreate() {
        const svc = servicesByBranch.find(s => s.id === serviceId);
        if (!svc) return alert(t('bookings.desk.errors.selectService', 'Выбери услугу'));
        if (!slotStartISO) return alert(t('bookings.desk.errors.noSlots', 'Нет свободных слотов на выбранные параметры'));
        if (!staffId) return alert(t('bookings.desk.errors.selectMaster', 'Выбери мастера'));

        // валидация клиента
        let p_client_id: string | null = null;

        if (clientMode === 'existing') {
            if (!selectedClientId) return alert(t('bookings.desk.errors.selectClient', 'Выбери клиента из поиска'));
            p_client_id = selectedClientId;
        }

        setCreating(true);
        try {
            const { data, error } = await supabase.rpc('create_internal_booking', {
                p_biz_id: bizId,
                p_branch_id: branchId,
                p_service_id: serviceId,
                p_staff_id: staffId,
                p_start: slotStartISO,
                p_minutes: svc.duration_min,
                p_client_id,
                p_client_name: null,
                p_client_phone: null,
            });
            if (error) {
                alert(error.message);
                return;
            }

            const bookingId = String(data);
            await notify('confirm', bookingId);
            alert(`${t('bookings.desk.created', 'Создана запись')} #${bookingId.slice(0, 8)}`);
            
            // Автосброс формы после успешного создания
            setServiceId('');
            setStaffId('');
            setSlotStartISO('');
            setSlots([]);
            setClientMode('none');
            setSelectedClientId('');
            setSearchQ('');
            setFoundUsers([]);
        } finally {
            setCreating(false);
        }
    }

    // Проверка готовности к созданию записи
    const canCreate = branchId && serviceId && staffId && slotStartISO && 
        (clientMode === 'none' || (clientMode === 'existing' && selectedClientId));

    const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    const tomorrow = formatInTimeZone(addDays(new Date(), 1), TZ, 'yyyy-MM-dd');

    return (
        <section className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="hidden sm:inline">{t('bookings.desk.title', 'Быстрая запись (стойка)')}</span>
                    <span className="sm:hidden">{t('bookings.desk.title', 'Стойка')}</span>
                </h2>
            </div>

            {/* Параметры записи */}
            <div className="space-y-3 sm:space-y-4">
                {/* Первая строка: Филиал, Услуга, Мастер */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Филиал */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('bookings.desk.branch', 'Филиал')}</label>
                        <select className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                            <option value="">{t('bookings.desk.selectBranch', 'Выберите филиал')}</option>
                            {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                        </select>
                    </div>

                    {/* Услуга */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('bookings.desk.service', 'Услуга')}</label>
                        <select className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={!branchId}>
                            <option value="">{branchId ? t('bookings.desk.selectService', 'Выберите услугу') : t('bookings.desk.selectBranchFirst', 'Сначала выберите филиал')}</option>
                            {servicesByBranch.map(s => (
                                <option key={s.id} value={s.id}>{getServiceName(s)} ({s.duration_min}м)</option>
                            ))}
                            {branchId && servicesByBranch.length === 0 && <option value="">{t('bookings.desk.noServices', 'Нет услуг в филиале')}</option>}
                        </select>
                    </div>

                    {/* Мастер */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('bookings.desk.master', 'Мастер')}</label>
                        <select className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" value={staffId} onChange={(e) => setStaffId(e.target.value)} disabled={!branchId}>
                            <option value="">{branchId ? t('bookings.desk.selectMaster', 'Выберите мастера') : t('bookings.desk.selectBranchFirst', 'Сначала выберите филиал')}</option>
                            {staffByBranch.map(m => (<option key={m.id} value={m.id}>{m.full_name}</option>))}
                            {branchId && staffByBranch.length === 0 && <option value="">{t('bookings.desk.noMasters', 'Нет мастеров в филиале')}</option>}
                        </select>
                    </div>
                </div>

                {/* Вторая строка: Дата и время */}
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('bookings.desk.date', 'Дата')}</label>
                    <div className="flex gap-2 items-center">
                        <button
                            type="button"
                            onClick={() => setDate(today)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                                date === today
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('bookings.desk.today', 'Сегодня')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setDate(tomorrow)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                                date === tomorrow
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('bookings.desk.tomorrow', 'Завтра')}
                        </button>
                        <input 
                            className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200" 
                            type="date" 
                            value={date} 
                            onChange={(e) => setDate(e.target.value)} 
                        />
                    </div>
                </div>

                {/* Слоты времени */}
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('bookings.desk.time', 'Время')}</label>
                    {slotsLoading ? (
                        <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                            <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('bookings.desk.loadingSlots', 'Загрузка слотов...')}
                        </div>
                    ) : slots.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                            {branchId && serviceId ? t('bookings.desk.noSlots', 'Нет свободных слотов') : t('bookings.desk.selectParamsFirst', 'Выберите филиал, услугу и мастера')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                            {slots.map((s, i) => {
                                const timeStr = formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm');
                                const isSelected = slotStartISO === s.start_at;
                                return (
                                    <button
                                        key={`${s.staff_id}-${s.start_at}-${i}`}
                                        type="button"
                                        onClick={() => setSlotStartISO(s.start_at)}
                                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white shadow-md'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700'
                                        }`}
                                    >
                                        {timeStr}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Блок клиента */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{t('bookings.desk.client', 'Клиент')}</div>

                <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="clientMode" checked={clientMode==='none'} onChange={()=>setClientMode('none')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{t('bookings.desk.clientNone', 'Без клиента (walk-in)')}</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="clientMode" checked={clientMode==='existing'} onChange={()=>setClientMode('existing')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{t('bookings.desk.clientExisting', 'Существующий')}</span>
                    </label>
                </div>

                {clientMode === 'existing' && (
                    <div className="space-y-3">
                        <div className="relative">
                            <input 
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 pr-10" 
                                placeholder={t('bookings.desk.searchPlaceholder', 'Поиск: +996..., email, ФИО')}
                                value={searchQ} 
                                onChange={e => setSearchQ(e.target.value)} 
                            />
                            {searchLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            )}
                        </div>
                        {searchErr && <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">{searchErr}</div>}
                        <div className="max-h-48 overflow-auto bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full text-sm">
                                <thead className="sticky top-0 z-[96]">
                                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 w-10">#</th>
                                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">{t('bookings.desk.clientName', 'Имя')}</th>
                                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">{t('bookings.desk.email', 'Email')}</th>
                                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3">{t('bookings.desk.clientPhone', 'Телефон')}</th>
                                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-3 w-24">{t('bookings.desk.select', 'Выбрать')}</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {foundUsers.map((u, i) => (
                                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <td className="p-3 text-gray-600 dark:text-gray-400">{i+1}</td>
                                        <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{u.full_name}</td>
                                        <td className="p-3 text-gray-700 dark:text-gray-300">{u.email ?? '—'}</td>
                                        <td className="p-3 text-gray-700 dark:text-gray-300">{u.phone ?? '—'}</td>
                                        <td className="p-3">
                                            <input
                                                type="radio"
                                                name="pickClient"
                                                checked={selectedClientId === u.id}
                                                onChange={()=>setSelectedClientId(u.id)}
                                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {foundUsers.length === 0 && (
                                    <tr><td className="p-4 text-center text-gray-500 dark:text-gray-400" colSpan={5}>{t('bookings.desk.noResults', 'Ничего не найдено')}</td></tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button 
                    className={`w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                        !canCreate || creating ? 'opacity-50 cursor-not-allowed' : 'hover:from-indigo-700 hover:to-pink-700'
                    }`}
                    onClick={quickCreate}
                    disabled={!canCreate || creating}
                >
                    {creating ? (
                        <>
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('bookings.desk.creating', 'Создание...')}
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            {t('bookings.desk.create', 'Создать запись')}
                        </>
                    )}
                </button>
            </div>
        </section>
    );
}


// ---------------- Root ----------------
export default function AdminBookingsView({
                                              bizId, services, staff, branches, initial,
                                          }: {
    bizId: string;
    services: ServiceRow[];
    staff: StaffRow[];
    branches: BranchRow[];
    initial: BookingItem[];
}) {
    const { t } = useLanguage();
    const [tab, setTab] = useState<TabKey>('calendar');
    return (
        <div className="px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">{t('bookings.title', 'Брони')}</h1>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('bookings.subtitle', 'Управление бронированиями')}</p>
                    </div>
                    <Tabs value={tab} onChange={setTab} />
                </div>
            </div>

            {tab === 'calendar' && <CalendarDay bizId={bizId} staff={staff} branches={branches} />}
            {tab === 'list'     && <ListTable   bizId={bizId} initial={initial} branches={branches} />}
            {tab === 'desk'     && <QuickDesk   bizId={bizId} services={services} staff={staff} branches={branches} />}
        </div>
    );
}
