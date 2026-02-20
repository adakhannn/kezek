'use client';

import { addDays, addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { fromZonedTime } from 'date-fns-tz';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { BookingFilters } from './components/BookingFilters';
import { BookingsList } from './components/BookingsList';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { logDebug, logError, logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';
import { getBusinessTimezone } from '@/lib/time';
import { validateName, validatePhone } from '@/lib/validation';


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
        logDebug('DashboardNotify', 'Calling notify API', { type, bookingId });
        const response = await fetch('/api/notify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type, booking_id: bookingId }),
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            logError('DashboardNotify', 'Notify API error', { 
                type, 
                bookingId, 
                status: response.status, 
                error: errorText 
            });
        } else {
            const result = await response.json().catch(() => ({}));
            logDebug('DashboardNotify', 'Notify API success', { type, bookingId, result });
        }
    } catch (e) {
        logError('DashboardNotify', 'Notify API exception', { type, bookingId, error: e });
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
function BookingPill({ id, startISO, endISO, status, timezone }: { id: string; startISO: string; endISO: string; status: BookingItem['status']; timezone: string }) {
    const { t } = useLanguage();
    const start = new Date(startISO);
    const end   = new Date(endISO);
    const label = `${formatInTimeZone(start, timezone, 'HH:mm')}–${formatInTimeZone(end, timezone, 'HH:mm')}`;
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

function ListTable({ bizId, initial, branches, timezone }: { bizId: string; initial: BookingItem[]; branches: BranchRow[]; timezone: string }) {
    const { t, locale } = useLanguage();
    const toast = useToast();
    const [list, setList] = useState<BookingItem[]>(initial);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalCount, setTotalCount] = useState<number>(initial.length);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Функция для получения названия услуги в зависимости от языка
    const getServiceName = (service: { name_ru: string; name_ky?: string | null } | undefined): string => {
        if (!service) return '';
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        return service.name_ru;
    };

    async function refresh() {
        setIsLoading(true);
        try {
            // Загружаем прошедшие брони (для отметки посещения) и будущие
            let query = supabase
                .from('bookings')
                .select('id,status,start_at,end_at,branch_id,services(name_ru,name_ky),staff(full_name),client_name,client_phone', { count: 'exact' })
                .eq('biz_id', bizId);
            
            if (statusFilter !== 'all') {
                if (statusFilter === 'active') {
                    query = query.in('status', ['confirmed']);
                } else {
                    query = query.eq('status', statusFilter);
                }
            } else {
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
    }, [statusFilter, branchFilter]);
    
    useEffect(() => {
        refresh();
    }, [statusFilter, branchFilter, currentPage, bizId]);

    async function _confirm(id: string) {
        const { error } = await supabase.rpc('confirm_booking', { p_booking_id: id });
        if (error) {
            toast.showError(error.message);
            return;
        }
        await notify('confirm', id);
        await refresh();
        toast.showSuccess(t('bookings.actions.confirmed', 'Бронь подтверждена'));
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
                    toast.showError(updateError.message);
                    return;
                }
            } else {
                toast.showError(error.message);
                return;
            }
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

    const statusColors = {
        hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
        no_show: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };

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

// ---------------- Quick Desk ----------------
function QuickDesk({ timezone,
                       bizId, services, staff, branches, onTabChange,
                   }: {
    timezone: string;
    bizId: string;
    services: ServiceRow[];
    staff: StaffRow[];
    branches: BranchRow[];
    onTabChange?: (tab: TabKey) => void;
}) {
    const { t, locale } = useLanguage();
    const toast = useToast();
    // выбранный филиал (начинаем с пустого, как в публичной версии)
    const [branchId, setBranchId] = useState<string>('');

    // Функция для получения названия услуги в зависимости от языка
    const getServiceName = (service: ServiceRow): string => {
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        if (locale === 'en' && service.name_en) return service.name_en;
        return service.name_ru;
    };

    // выбранные значения (начинаем с пустых, как в публичной версии)
    const [serviceId, setServiceId]   = useState<string>('');
    const [staffId, setStaffId]       = useState<string>('');
    const [date, setDate]             = useState<string>(() => formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd'));

    // Временные переводы для выбранной даты
    // Загружаем для всех филиалов, чтобы корректно определить временные переводы независимо от выбранного филиала
    const [temporaryTransfers, setTemporaryTransfers] = useState<Array<{ staff_id: string; branch_id: string; date: string }>>([]);
    
    // Загрузка временных переводов для выбранной даты (для всех филиалов)
    useEffect(() => {
        if (!date || !bizId || staff.length === 0) {
            setTemporaryTransfers([]);
            return;
        }
        let ignore = false;
        (async () => {
            // Создаем мапку staff_id -> home branch_id для определения временных переводов
            const staffHomeBranches = new Map<string, string>();
            for (const s of staff) {
                staffHomeBranches.set(s.id, s.branch_id);
            }
            
            const staffIds = Array.from(staffHomeBranches.keys());
            
            // Загружаем все правила расписания для всех сотрудников на выбранную дату
            // Убираем фильтр по branch_id, чтобы загрузить ВСЕ временные переводы
            const { data, error } = await supabase
                .from('staff_schedule_rules')
                .select('staff_id, branch_id, date_on')
                .eq('biz_id', bizId)
                .in('staff_id', staffIds)
                .eq('kind', 'date')
                .eq('is_active', true)
                .eq('date_on', date);
            
            if (ignore) return;
            if (error) {
                logError('QuickDesk', 'Error loading temporary transfers', error);
                setTemporaryTransfers([]);
                return;
            }
            
            // Фильтруем: временный перевод = branch_id в правиле отличается от домашнего филиала сотрудника
            const transfers = (data ?? [])
                .filter((rule: { staff_id: string; branch_id: string; date_on: string }) => {
                    const homeBranchId = staffHomeBranches.get(rule.staff_id);
                    return homeBranchId && rule.branch_id !== homeBranchId;
                })
                .map((rule: { staff_id: string; branch_id: string; date_on: string }) => ({
                    staff_id: rule.staff_id,
                    branch_id: rule.branch_id,
                    date: rule.date_on,
                }));
            
            setTemporaryTransfers(transfers);
        })();
        return () => { ignore = true; };
    }, [date, bizId, staff]);

    /* ---------- сервисные навыки мастеров (service_staff) ---------- */
    const [serviceStaff, setServiceStaff] = useState<Array<{ service_id: string; staff_id: string; is_active: boolean }> | null>(null);
    useEffect(() => {
        let ignore = false;
        (async () => {
            // Загружаем только связи для мастеров этого бизнеса
            const staffIds = staff.map((s) => s.id);
            if (staffIds.length === 0) {
                setServiceStaff([]);
                return;
            }
            const { data, error } = await supabase
                .from('service_staff')
                .select('service_id,staff_id,is_active')
                .eq('is_active', true)
                .in('staff_id', staffIds);
            if (ignore) return;
            if (error) {
                logWarn('QuickDesk', 'service_staff read error', error);
                setServiceStaff(null); // нет доступа — UI живёт без фильтра по навыкам
            } else {
                setServiceStaff((data ?? []) as Array<{ service_id: string; staff_id: string; is_active: boolean }>);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [staff]);

    // мапка service_id -> Set(staff_id)
    const serviceToStaffMap = useMemo(() => {
        if (!serviceStaff || serviceStaff.length === 0) return null;
        const map = new Map<string, Set<string>>();
        for (const row of serviceStaff) {
            if (!row.is_active) continue;
            if (!map.has(row.service_id)) map.set(row.service_id, new Set());
            map.get(row.service_id)!.add(row.staff_id);
        }
        return map;
    }, [serviceStaff]);

    // Список мастеров: по филиалу + временные переводы В этот филиал на выбранную дату
    // Исключаем мастеров, которые временно переведены В ДРУГОЙ филиал на эту дату
    // Мастера показываются только после выбора филиала и даты
    const staffByBranch = useMemo(() => {
        if (!branchId || !date) return [];
        
        // Основные сотрудники филиала
        const mainStaff = staff.filter(s => s.branch_id === branchId);
        const mainStaffIds = new Set(mainStaff.map(s => s.id));
        
        // Временно переведенные В выбранный филиал на эту дату
        const transfersToThisBranch = temporaryTransfers.filter((t: { staff_id: string; branch_id: string; date: string }) => 
            t.date === date && t.branch_id === branchId
        );
        const tempStaffIdsToThisBranch = new Set(transfersToThisBranch.map((t: { staff_id: string; branch_id: string; date: string }) => t.staff_id));
        
        // Мастера, временно переведенные В ДРУГОЙ филиал на эту дату (их нужно исключить из основного филиала)
        const transfersToOtherBranch = temporaryTransfers.filter((t: { staff_id: string; branch_id: string; date: string }) => 
            t.date === date && t.branch_id !== branchId
        );
        const tempStaffIdsToOtherBranch = new Set(transfersToOtherBranch.map((t: { staff_id: string; branch_id: string; date: string }) => t.staff_id));
        
        // Объединяем основных сотрудников и временно переведенных В этот филиал
        const allStaffIds = new Set([...mainStaffIds, ...tempStaffIdsToThisBranch]);
        
        // Исключаем мастеров, которые временно переведены В ДРУГОЙ филиал
        return staff.filter(s => {
            const isIncluded = allStaffIds.has(s.id);
            const isTransferredToOther = tempStaffIdsToOtherBranch.has(s.id);
            
            // Показываем мастера, если он включен (основной в филиале или переведен в этот филиал)
            // И не переведен в другой филиал
            return isIncluded && !isTransferredToOther;
        });
    }, [staff, branchId, temporaryTransfers, date]);

    // Фильтрация услуг: для временно переведенного мастера показываем услуги из филиала временного перевода
    // Для обычного мастера показываем услуги из выбранного филиала
    // Услуги показываются только после выбора филиала, даты и мастера
    const servicesByBranch = useMemo(() => {
        if (!branchId || !date || !staffId) return [];
        
        // Проверяем, является ли мастер временно переведенным
        const tempTransfer = temporaryTransfers.find((t: { staff_id: string; branch_id: string; date: string }) => 
            t.staff_id === staffId && t.date === date
        );
        
        // Если мастер временно переведен, используем филиал временного перевода
        // Иначе используем выбранный филиал
        const targetBranchId = tempTransfer ? tempTransfer.branch_id : branchId;
        
        // Фильтруем услуги по целевому филиалу (временному или выбранному)
        let filteredServices = services.filter(s => s.branch_id === targetBranchId);
        
        // Если есть serviceToStaffMap, дополнительно фильтруем по навыкам мастера
        // Для временно переведенного мастера проверяем похожие услуги (с тем же названием и длительностью)
        if (serviceToStaffMap) {
            // Находим все услуги, которые делает выбранный мастер
            const servicesForStaff = new Set<string>();
            for (const [serviceId, staffSet] of serviceToStaffMap.entries()) {
                if (staffSet.has(staffId)) {
                    servicesForStaff.add(serviceId);
                }
            }
            
            // Если мастер временно переведен, проверяем похожие услуги
            if (tempTransfer) {
                filteredServices = filteredServices.filter(s => {
                    // Проверяем, есть ли прямая связь с этой услугой
                    if (servicesForStaff.has(s.id)) {
                        return true;
                    }
                    
                    // Для временно переведенного мастера: если услуга в целевом филиале, но нет прямой связи service_staff,
                    // проверяем, есть ли у мастера связь с услугой с таким же названием в другом филиале
                    const hasSimilarServiceLink = services.some(svc => 
                        svc.name_ru === s.name_ru && 
                        svc.duration_min === s.duration_min && 
                        svc.id !== s.id &&
                        servicesForStaff.has(svc.id)
                    );
                    
                    // Если есть похожая услуга, которую мастер делает - показываем её
                    return hasSimilarServiceLink;
                });
            } else {
                // Для обычного мастера показываем только услуги, которые он делает
                filteredServices = filteredServices.filter(s => servicesForStaff.has(s.id));
            }
        }
        
        return filteredServices;
    }, [services, branchId, staffId, date, temporaryTransfers, serviceToStaffMap]);

    // при смене мастера или даты — сбрасываем выбор услуги, если текущая не подходит
    // (этот useEffect уже не нужен, так как мы сбрасываем serviceId в useEffect выше при смене staffId)
    // Но оставляем для валидации, если услуга была выбрана до смены мастера/даты
    useEffect(() => {
        if (!staffId || !date || !serviceId) return;
        // Если выбранная услуга не подходит под текущего мастера или дату — сбрасываем выбор услуги
        const isServiceValid = servicesByBranch.some((s) => s.id === serviceId);
        if (!isServiceValid) {
            logDebug('QuickDesk', 'Service is not valid for current staff/date, clearing serviceId', { serviceId, staffId, date, servicesByBranch: servicesByBranch.map(s => s.id) });
            setServiceId('');
        }
    }, [staffId, date, servicesByBranch, serviceId]);

    // слоты
    const [slots, setSlots] = useState<RpcSlot[]>([]);
    const [slotStartISO, setSlotStartISO] = useState<string>('');
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // Статистика для панели статуса
    const [statusStats, setStatusStats] = useState<{
        todayCount: number;
        tomorrowCount: number;
        todayFreeSlots: number;
        tomorrowFreeSlots: number;
        loading: boolean;
    }>({
        todayCount: 0,
        tomorrowCount: 0,
        todayFreeSlots: 0,
        tomorrowFreeSlots: 0,
        loading: true,
    });

    // ====== Клиент ======
    type ClientMode = 'none' | 'existing' | 'new';
    const [clientMode, setClientMode] = useState<ClientMode>('none');

    // существующий клиент (поиск)
    const [searchQ, setSearchQ] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchErr, setSearchErr] = useState<string | null>(null);
    const [foundUsers, setFoundUsers] = useState<{id:string; full_name:string; email:string|null; phone:string|null}[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    // новый клиент (по телефону/лично)
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

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
        setDate(formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd')); // Сбрасываем дату на сегодня
        setServiceId('');
        setStaffId('');
        setSlots([]);
        setSlotStartISO('');
    }, [branchId]);
    
    // при смене даты — сбрасываем выбор мастера, услуги и слотов
    useEffect(() => {
        setStaffId('');
        setServiceId('');
        setSlots([]);
        setSlotStartISO('');
    }, [date]);
    
    // при смене мастера — сбрасываем выбор услуги и слотов
    useEffect(() => {
        setServiceId('');
        setSlots([]);
        setSlotStartISO('');
    }, [staffId]);

    // загрузка слотов
    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!branchId || !serviceId || !date) { setSlots([]); setSlotStartISO(''); setSlotsLoading(false); return; }
            
            // Определяем целевой филиал: для временно переведенного мастера используем филиал временного перевода
            let targetBranchId = branchId;
            if (staffId && date) {
                const tempTransfer = temporaryTransfers.find((t: { staff_id: string; branch_id: string; date: string }) => 
                    t.staff_id === staffId && t.date === date
                );
                if (tempTransfer) {
                    targetBranchId = tempTransfer.branch_id;
                    logDebug('QuickDesk', 'Temporary transfer found for slots loading', { staffId, date, tempBranch: tempTransfer.branch_id, selectedBranch: branchId });
                }
            }
            
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
                logError('QuickDesk', 'get_free_slots_service_day_v2 error', error);
                setSlots([]); setSlotStartISO(''); setSlotsLoading(false);
                return;
            }
            const raw = (data || []) as RpcSlot[];
            const now = new Date();
            const minTime = addMinutes(now, 30); // минимум через 30 минут от текущего времени
            
            // Фильтруем по целевому филиалу (временному или выбранному), мастеру (если выбран) и времени
            // Для временно переведенного мастера принимаем слоты только из филиала временного перевода
            const filtered = raw
                .filter(s => {
                    // Для временно переведенного мастера принимаем слоты только из филиала временного перевода
                    if (staffId && targetBranchId !== branchId) {
                        return s.branch_id === targetBranchId;
                    }
                    // Для обычного мастера показываем только слоты из выбранного филиала
                    return s.branch_id === branchId;
                })
                .filter(s => staffId ? s.staff_id === staffId : true)
                .filter(s => new Date(s.start_at) > minTime);

            // dedupe по start_at
            const uniq = Array.from(new Map(filtered.map(s => [s.start_at, s])).values());
            setSlots(uniq);
            setSlotStartISO(prev => (prev && uniq.some(u => u.start_at === prev)) ? prev : (uniq[0]?.start_at || ''));
            setSlotsLoading(false);
        })();
        return () => { ignore = true; };
    }, [bizId, serviceId, staffId, date, branchId, temporaryTransfers]);

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

    // Сброс полей при смене режима клиента
    useEffect(() => {
        if (clientMode !== 'new') {
            setNewClientName('');
            setNewClientPhone('');
        }
        if (clientMode !== 'existing') {
            setSearchQ('');
            setFoundUsers([]);
            setSelectedClientId('');
        }
    }, [clientMode]);

    async function quickCreate() {
        const svc = servicesByBranch.find(s => s.id === serviceId);
        if (!svc) {
            toast.showError(t('bookings.desk.errors.selectService', 'Выбери услугу'));
            return;
        }
        if (!slotStartISO) {
            toast.showError(t('bookings.desk.errors.noSlots', 'Нет свободных слотов на выбранные параметры'));
            return;
        }
        if (!staffId) {
            toast.showError(t('bookings.desk.errors.selectMaster', 'Выбери мастера'));
            return;
        }

        // Определяем целевой филиал для создания брони: для временно переведенного мастера используем филиал временного перевода
        let targetBranchId = branchId;
        if (date) {
            const tempTransfer = temporaryTransfers.find((t: { staff_id: string; branch_id: string; date: string }) => 
                t.staff_id === staffId && t.date === date
            );
            if (tempTransfer) {
                targetBranchId = tempTransfer.branch_id;
                logDebug('QuickDesk', 'Creating booking with temporary branch', { staffId, date, tempBranch: tempTransfer.branch_id, selectedBranch: branchId });
            }
        }

        // валидация клиента
        let p_client_id: string | null = null;
        let p_client_name: string | null = null;
        let p_client_phone: string | null = null;

        if (clientMode === 'existing') {
            if (!selectedClientId) {
                toast.showError(t('bookings.desk.errors.selectClient', 'Выбери клиента из поиска'));
                return;
            }
            p_client_id = selectedClientId;
        } else if (clientMode === 'new') {
            const name = newClientName.trim();
            const phone = newClientPhone.trim();

            // Валидация имени
            const nameValidation = validateName(name, true);
            if (!nameValidation.valid) {
                toast.showError(nameValidation.error || t('bookings.desk.errors.nameRequired', 'Введите имя клиента'));
                return;
            }

            // Валидация телефона
            const phoneValidation = validatePhone(phone, true);
            if (!phoneValidation.valid) {
                toast.showError(
                    phoneValidation.error ||
                        t('bookings.desk.errors.phoneRequired', 'Введите корректный номер телефона')
                );
                return;
            }

            p_client_name = name;
            p_client_phone = phone;
        }

        setCreating(true);
        try {
            const { data, error } = await supabase.rpc('create_internal_booking', {
                p_biz_id: bizId,
                p_branch_id: targetBranchId, // Используем целевой филиал (временный или выбранный)
                p_service_id: serviceId,
                p_staff_id: staffId,
                p_start: slotStartISO,
                p_minutes: svc.duration_min,
                p_client_id,
                p_client_name,
                p_client_phone,
            });
            if (error) {
                toast.showError(error.message);
                return;
            }

            const bookingId = String(data);
            await notify('confirm', bookingId);
            toast.showSuccess(
                `${t('bookings.desk.created', 'Создана запись')} #${bookingId.slice(0, 8)}`
            );
            
            // Автосброс формы после успешного создания
            setServiceId('');
            setStaffId('');
            setSlotStartISO('');
            setSlots([]);
            setClientMode('none');
            setSelectedClientId('');
            setSearchQ('');
            setFoundUsers([]);
            setNewClientName('');
            setNewClientPhone('');
        } finally {
            setCreating(false);
        }
    }

    // Проверка готовности к созданию записи
    const canCreate = branchId && serviceId && staffId && slotStartISO && 
        (clientMode === 'none' || 
         (clientMode === 'existing' && selectedClientId) ||
         (clientMode === 'new' && newClientName.trim() && newClientPhone.trim()));

    const today = formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
    const tomorrow = formatInTimeZone(addDays(new Date(), 1), timezone, 'yyyy-MM-dd');

    return (
        <section className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-4 sm:space-y-6">
            {/* Панель статуса */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('bookings.desk.statusPanel.title', 'Статус на сегодня/завтра')}
                    </h3>
                    {onTabChange && (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => onTabChange('calendar')}
                                className="px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                {t('bookings.desk.statusPanel.goToCalendar', 'Календарь')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onTabChange('list')}
                                className="px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                {t('bookings.desk.statusPanel.goToList', 'Список')}
                            </button>
                        </div>
                    )}
                </div>
                {statusStats.loading ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('bookings.desk.statusPanel.loading', 'Загрузка...')}</div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {/* Сегодня */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                {t('bookings.desk.statusPanel.today', 'Сегодня')}
                            </div>
                            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                                {statusStats.todayCount} {t('bookings.desk.statusPanel.bookings', 'записей')}
                            </div>
                            {slots.length > 0 && date === today && (
                                <div className="text-xs text-indigo-600 dark:text-indigo-400">
                                    {slots.length} {t('bookings.desk.statusPanel.freeSlots', 'свободных слотов')}
                                </div>
                            )}
                        </div>
                        {/* Завтра */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                {t('bookings.desk.statusPanel.tomorrow', 'Завтра')}
                            </div>
                            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                                {statusStats.tomorrowCount} {t('bookings.desk.statusPanel.bookings', 'записей')}
                            </div>
                            {slots.length > 0 && date === tomorrow && (
                                <div className="text-xs text-indigo-600 dark:text-indigo-400">
                                    {slots.length} {t('bookings.desk.statusPanel.freeSlots', 'свободных слотов')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

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
                {/* Первая строка: Филиал, Дата, Мастер */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Филиал */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('bookings.desk.branch', 'Филиал')}</label>
                        <select className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                            <option value="">{t('bookings.desk.selectBranch', 'Выберите филиал')}</option>
                            {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                        </select>
                    </div>

                    {/* Дата */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('bookings.desk.date', 'Дата')}</label>
                        <div className="flex gap-2 items-center">
                            <button
                                type="button"
                                onClick={() => setDate(today)}
                                className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                                    date === today
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                                disabled={!branchId}
                            >
                                {t('bookings.desk.today', 'Сегодня')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setDate(tomorrow)}
                                className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                                    date === tomorrow
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                                disabled={!branchId}
                            >
                                {t('bookings.desk.tomorrow', 'Завтра')}
                            </button>
                            <input 
                                className="flex-1 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                                type="date" 
                                value={date} 
                                onChange={(e) => setDate(e.target.value)}
                                disabled={!branchId}
                            />
                        </div>
                    </div>

                    {/* Мастер */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('bookings.desk.master', 'Мастер')}</label>
                        <select className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" value={staffId} onChange={(e) => setStaffId(e.target.value)} disabled={!branchId || !date}>
                            <option value="">{!branchId ? t('bookings.desk.selectBranchFirst', 'Сначала выберите филиал') : !date ? t('bookings.desk.selectDateFirst', 'Сначала выберите дату') : t('bookings.desk.selectMaster', 'Выберите мастера')}</option>
                            {staffByBranch.map(m => (<option key={m.id} value={m.id}>{m.full_name}</option>))}
                            {branchId && date && staffByBranch.length === 0 && <option value="">{t('bookings.desk.noMasters', 'Нет мастеров в филиале')}</option>}
                        </select>
                    </div>
                </div>

                {/* Вторая строка: Услуга */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('bookings.desk.service', 'Услуга')}</label>
                    <select className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={!branchId || !date || !staffId}>
                        <option value="">{!branchId ? t('bookings.desk.selectBranchFirst', 'Сначала выберите филиал') : !date ? t('bookings.desk.selectDateFirst', 'Сначала выберите дату') : !staffId ? t('bookings.desk.selectMasterFirst', 'Сначала выберите мастера') : t('bookings.desk.selectService', 'Выберите услугу')}</option>
                        {servicesByBranch.map(s => (
                            <option key={s.id} value={s.id}>{getServiceName(s)} ({s.duration_min}м)</option>
                        ))}
                        {branchId && date && staffId && servicesByBranch.length === 0 && <option value="">{t('bookings.desk.noServices', 'Нет услуг в филиале')}</option>}
                    </select>
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
                            {branchId && date && staffId && serviceId ? t('bookings.desk.noSlots', 'Нет свободных слотов') : t('bookings.desk.selectParamsFirst', 'Выберите филиал, дату, мастера и услугу')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                            {slots.map((s, i) => {
                                const timeStr = formatInTimeZone(new Date(s.start_at), timezone, 'HH:mm');
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
            <div className={`rounded-xl p-4 border-2 space-y-4 transition-all duration-200 ${
                clientMode === 'existing' 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
                    : clientMode === 'new'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}>
                <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{t('bookings.desk.client', 'Клиент')}</div>
                    {clientMode === 'existing' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t('bookings.desk.clientMode.found', 'Клиент найден')}
                        </span>
                    )}
                    {clientMode === 'new' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            {t('bookings.desk.clientMode.new', 'Новый клиент')}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Без клиента (walk-in) */}
                    <label className={`inline-flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        clientMode === 'none'
                            ? 'bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}>
                        <input 
                            type="radio" 
                            name="clientMode" 
                            checked={clientMode==='none'} 
                            onChange={()=>setClientMode('none')} 
                            className="w-4 h-4 text-gray-600 focus:ring-gray-500" 
                        />
                        <div className="flex items-center gap-2 flex-1">
                            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('bookings.desk.clientNone', 'Без клиента')}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{t('bookings.desk.clientNone.hint', 'Walk-in')}</div>
                            </div>
                        </div>
                    </label>

                    {/* Существующий клиент */}
                    <label className={`inline-flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        clientMode === 'existing'
                            ? 'bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-600 shadow-sm'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-700'
                    }`}>
                        <input 
                            type="radio" 
                            name="clientMode" 
                            checked={clientMode==='existing'} 
                            onChange={()=>setClientMode('existing')} 
                            className="w-4 h-4 text-green-600 focus:ring-green-500" 
                        />
                        <div className="flex items-center gap-2 flex-1">
                            <svg className={`w-5 h-5 ${clientMode === 'existing' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <div className="flex-1">
                                <div className={`text-sm font-medium ${clientMode === 'existing' ? 'text-green-900 dark:text-green-100' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {t('bookings.desk.clientExisting', 'Существующий')}
                                </div>
                                <div className={`text-xs ${clientMode === 'existing' ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {t('bookings.desk.clientExisting.hint', 'Поиск в базе')}
                                </div>
                            </div>
                        </div>
                    </label>

                    {/* Новый клиент */}
                    <label className={`inline-flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        clientMode === 'new'
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 shadow-sm'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}>
                        <input 
                            type="radio" 
                            name="clientMode" 
                            checked={clientMode==='new'} 
                            onChange={()=>setClientMode('new')} 
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500" 
                        />
                        <div className="flex items-center gap-2 flex-1">
                            <svg className={`w-5 h-5 ${clientMode === 'new' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <div className="flex-1">
                                <div className={`text-sm font-medium ${clientMode === 'new' ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {t('bookings.desk.clientNew', 'Новый клиент')}
                                </div>
                                <div className={`text-xs ${clientMode === 'new' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {t('bookings.desk.clientNew.hint', 'Звонок/лично')}
                                </div>
                            </div>
                        </div>
                    </label>
                </div>

                {clientMode === 'existing' && (
                    <div className="space-y-3">
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-xs font-medium text-green-700 dark:text-green-300">
                                    {t('bookings.desk.clientExisting.searchHint', 'Найдите клиента в базе по телефону, email или имени')}
                                </span>
                            </div>
                            <div className="relative">
                                <input 
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border-2 border-green-300 dark:border-green-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 pr-10" 
                                    placeholder={t('bookings.desk.searchPlaceholder', 'Поиск: +996..., email, ФИО')}
                                    value={searchQ} 
                                    onChange={e => setSearchQ(e.target.value)} 
                                />
                                {searchLoading && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <svg className="animate-spin h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                        {searchErr && <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">{searchErr}</div>}
                        <div className="max-h-48 overflow-auto bg-white dark:bg-gray-900 rounded-lg border-2 border-green-200 dark:border-green-800">
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
                                                onChange={() => setSelectedClientId(u.id)}
                                                className="w-4 h-4 text-green-600 focus:ring-green-500"
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {foundUsers.length === 0 && (
                                    <tr>
                                        <td className="p-4 text-center text-gray-500 dark:text-gray-400" colSpan={5}>
                                            {t('bookings.desk.noResults', 'Ничего не найдено')}
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {clientMode === 'new' && (
                    <div className="space-y-3">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-3">
                                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                    {t('bookings.desk.clientNew.formHint', 'Введите данные нового клиента (звонок или личный визит)')}
                                </span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        {t('bookings.desk.clientName', 'Имя')} <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border-2 border-blue-300 dark:border-blue-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
                                        placeholder={t('bookings.desk.newClientNamePlaceholder', 'Введите имя клиента')}
                                        value={newClientName} 
                                        onChange={e => setNewClientName(e.target.value)} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        {t('bookings.desk.clientPhone', 'Телефон')} <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="tel"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border-2 border-blue-300 dark:border-blue-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
                                        placeholder={t('bookings.desk.newClientPhonePlaceholder', '+996555123456')}
                                        value={newClientPhone} 
                                        onChange={e => setNewClientPhone(e.target.value)} 
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {t('bookings.desk.phoneFormat', 'Формат: +996555123456')}
                                    </p>
                                </div>
                            </div>
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
