'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { fromZonedTime } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { BookingFilters } from './components/BookingFilters';
import { BookingsList } from './components/BookingsList';
import { FilterPreset, applyPreset } from './components/FilterPresets';
import { QuickDesk } from './components/QuickDesk';
import { notify } from './notify';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { BookingCard } from '@/components/dashboard';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { cancelBookingWithFallback, confirmBooking } from '@/lib/bookingDashboardService';
import { logError, logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';
import { getBusinessTimezone } from '@/lib/time';


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

function BookingPill({ id, startISO, endISO, status, timezone }: { id: string; startISO: string; endISO: string; status: BookingItem['status']; timezone: string }) {
    return (
        <BookingCard
            id={id}
            startISO={startISO}
            endISO={endISO}
            status={status}
            timezone={timezone}
            href={`/booking/${id}`}
        />
    );
}

function CalendarDay({ bizId, staff, branches, timezone }: { bizId: string; staff: StaffRow[]; branches: BranchRow[]; timezone: string }) {
    const { t } = useLanguage();
    const [date, setDate] = useState<string>(() => formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd'));
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
            start_at: formatInTimeZone(new Date(r.start_at), timezone, 'yyyy-MM-dd HH:mm'),
            end_at:   formatInTimeZone(new Date(r.end_at), timezone, 'yyyy-MM-dd HH:mm'),
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
            // Используем таймзону бизнеса для расчета начала и конца дня
            const startOfDay = fromZonedTime(`${date}T00:00:00`, timezone);
            const endOfDay = fromZonedTime(`${date}T23:59:59.999`, timezone);
            const startDay = startOfDay.toISOString();
            const endDay = endOfDay.toISOString();
            const { data, error } = await supabase
                .from('bookings')
                .select('id,staff_id,start_at,end_at,status')
                .eq('biz_id', bizId)
                .neq('status', 'cancelled')
                .gte('start_at', startDay)
                .lte('start_at', endDay)
                .order('start_at', { ascending: true });
            if (ignore) return;
            if (error) { logError('CalendarDay', 'Error loading bookings', error); setItems([]); return; }
            setItems((data ?? []).map(r => ({
                id: String(r.id),
                staff_id: String(r.staff_id),
                start_at: String(r.start_at),
                end_at: String(r.end_at),
                status: r.status as BookingItem['status'],
            })));
        })();
        return () => { ignore = true; };
    }, [bizId, date, timezone]);

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
                                                <BookingPill id={ev.id} startISO={ev.start_at} endISO={ev.end_at} status={ev.status} timezone={timezone} />
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
                    {t('bookings.status.paid', 'Выполнено')}
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
const ITEMS_PER_PAGE = 30;

function useDashboardBookingsFilters(initialTotal: number) {
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalCount, setTotalCount] = useState<number>(initialTotal);
    const [activePreset, setActivePreset] = useState<FilterPreset>(null);

    return {
        statusFilter,
        branchFilter,
        searchQuery,
        currentPage,
        totalCount,
        activePreset,
        setStatusFilter,
        setBranchFilter,
        setSearchQuery,
        setCurrentPage,
        setTotalCount,
        setActivePreset,
    };
}

function ListTable({ bizId, initial, branches, timezone }: { bizId: string; initial: BookingItem[]; branches: BranchRow[]; timezone: string }) {
    const { t, locale } = useLanguage();
    const toast = useToast();
    const [list, setList] = useState<BookingItem[]>(initial);
    const {
        statusFilter,
        branchFilter,
        searchQuery,
        currentPage,
        totalCount,
        activePreset,
        setStatusFilter,
        setBranchFilter,
        setSearchQuery,
        setCurrentPage,
        setTotalCount,
        setActivePreset,
    } = useDashboardBookingsFilters(initial.length);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
    const [hasStaffAccess, setHasStaffAccess] = useState<boolean>(false);

    // Получаем текущего пользователя и его staff_id
    useEffect(() => {
        async function fetchCurrentStaff() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: staff } = await supabase
                    .from('staff')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .maybeSingle();

                if (staff) {
                    setCurrentStaffId(staff.id);
                    setHasStaffAccess(true);
                }
            } catch (error) {
                logWarn('ListTable', 'Failed to fetch current staff', error);
            }
        }
        fetchCurrentStaff();
    }, []);

    async function refresh() {
        setIsLoading(true);
        try {
            // Загружаем прошедшие брони (для отметки посещения) и будущие
            let query = supabase
                .from('bookings')
                .select('id,status,start_at,end_at,branch_id,staff_id,services(name_ru,name_ky),staff(full_name),client_name,client_phone', { count: 'exact' })
                .eq('biz_id', bizId);
            
            // Применяем пресет
            if (activePreset) {
                const presetFilters = applyPreset(activePreset, timezone, currentStaffId);
                
                if (presetFilters.dateFilter) {
                    query = query.gte('start_at', presetFilters.dateFilter.gte);
                    query = query.lte('start_at', presetFilters.dateFilter.lte);
                }
                
                if (presetFilters.staffFilter) {
                    query = query.eq('staff_id', presetFilters.staffFilter);
                }
                
                if (presetFilters.statusFilter === 'holdConfirmed') {
                    query = query.in('status', ['hold', 'confirmed']);
                }
            }
            
            if (statusFilter !== 'all' && !activePreset) {
                if (statusFilter === 'active') {
                    query = query.in('status', ['confirmed']);
                } else {
                    query = query.eq('status', statusFilter);
                }
            } else if (!activePreset) {
                query = query.neq('status', 'cancelled');
            }
            
            if (branchFilter !== 'all') {
                query = query.eq('branch_id', branchFilter);
            }
            
            // Применяем поиск на сервере, если возможно, иначе на клиенте
            // Для простоты оставляем поиск на клиенте, но ограничиваем количество загружаемых данных
            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;
            
            const { data, count } = await query
                .order('start_at', { ascending: false })
                .range(from, to);
            
            setTotalCount(count ?? 0);
            
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
        } finally {
            setIsLoading(false);
        }
    }
    
    useEffect(() => {
        setCurrentPage(1); // Сбрасываем на первую страницу при изменении фильтров
    }, [statusFilter, branchFilter, activePreset]);
    
    useEffect(() => {
        refresh();
    }, [statusFilter, branchFilter, currentPage, bizId, activePreset]);

    async function _confirm(id: string) {
        try {
            await confirmBooking(id);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            toast.showError(message);
            return;
        }

        await notify('confirm', id);
        await refresh();
        toast.showSuccess(t('bookings.actions.confirmed', 'Бронь подтверждена'));
    }

    async function cancel(id: string) {
        try {
            await cancelBookingWithFallback(id);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            toast.showError(message);
            return;
        }

        await notify('cancel', id);
        await refresh();
        toast.showSuccess(t('bookings.actions.cancelled', 'Бронь отменена'));
    }

    async function markAttendance(id: string, attended: boolean) {
        const res = await fetch(`/api/bookings/${id}/mark-attendance`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ attended }),
        });
        const j = await res.json();
        if (!j.ok) {
            toast.showError(j.error || t('bookings.list.markAttendanceError', 'Не удалось обновить статус'));
            return;
        }
        await refresh();
        toast.showSuccess(
            attended
                ? t('bookings.actions.attended', 'Клиент пришёл')
                : t('bookings.actions.noShow', 'Клиент не пришёл')
        );
    }

    return (
        <>
        <section className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-3 sm:space-y-4">
            <BookingFilters
                statusFilter={statusFilter}
                branchFilter={branchFilter}
                searchQuery={searchQuery}
                branches={branches}
                onStatusChange={setStatusFilter}
                onBranchChange={setBranchFilter}
                onSearchChange={setSearchQuery}
                onRefresh={refresh}
                isLoading={isLoading}
                activePreset={activePreset}
                onPresetChange={setActivePreset}
                timezone={timezone}
                currentStaffId={currentStaffId}
                hasStaffAccess={hasStaffAccess}
            />
            
            <BookingsList
                bookings={list}
                branches={branches}
                onConfirm={_confirm}
                onCancel={cancel}
                onMarkAttendance={markAttendance}
                isLoading={isLoading}
                currentPage={currentPage}
                totalCount={totalCount}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
            />
        </section>
        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}

// ---------------- Root ----------------
export default function AdminBookingsView({
                                              bizId, businessTz, services, staff, branches, initial,
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

            {tab === 'calendar' && <CalendarDay bizId={bizId} staff={staff} branches={branches} timezone={timezone} />}
            {tab === 'list'     && <ListTable   bizId={bizId} initial={initial} branches={branches} timezone={timezone} />}
            {tab === 'desk'     && <QuickDesk   bizId={bizId} services={services} staff={staff} branches={branches} onTabChange={setTab} timezone={timezone} />}
        </div>
    );
}
