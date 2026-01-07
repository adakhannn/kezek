// apps/web/src/app/[slug]/view.tsx
'use client';

import { addDays, addMinutes, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import {useLanguage} from '@/app/_components/i18n/LanguageProvider';
import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import { supabase } from '@/lib/supabaseClient';
import { todayTz, dateAtTz, toLabel, TZ } from '@/lib/time';

type Biz = { id: string; slug: string; name: string; address: string; phones: string[] };
type Branch = { id: string; name: string };
type Service = {
    id: string;
    name_ru: string;
    duration_min: number;
    price_from?: number | null;
    price_to?: number | null;
    branch_id: string;
};
type Staff = { id: string; full_name: string; branch_id: string };

type Data = {
    biz: Biz;
    branches: Branch[];
    services: Service[];
    staff: Staff[];
};


// связь услуга ↔ мастер
type ServiceStaffRow = { service_id: string; staff_id: string; is_active: boolean };

// RPC get_free_slots_service_day_v2
type Slot = {
    staff_id: string;
    branch_id: string;
    start_at: string;
    end_at: string;
};

function fmtErr(e: unknown): string {
    if (e && typeof e === 'object') {
        const any = e as { message?: string; details?: string; hint?: string; code?: string };
        const rawMessage = any.message || '';

        // Пользовательский текст для частых бизнес-ошибок
        if (rawMessage.includes('is not assigned to branch')) {
            return 'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.';
        }

        if (any.message) {
            const parts = [
                any.message,
                any.details && `Details: ${any.details}`,
                any.hint && `Hint: ${any.hint}`,
                any.code && `Code: ${any.code}`,
            ].filter(Boolean);
            return parts.join('\n');
        }
    }
    if (e instanceof Error) return e.message;
    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
}

export default function BizClient({ data }: { data: Data }) {
    const { biz, branches, services, staff } = data;
    const {t} = useLanguage();

    /* ---------- auth ---------- */
    const [isAuthed, setIsAuthed] = useState<boolean>(false);
    useEffect(() => {
        let ignore = false;
        (async () => {
            const { data: auth } = await supabase.auth.getUser();
            if (!ignore) setIsAuthed(!!auth.user);
        })();
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
            setIsAuthed(!!s?.user);
        });
        return () => {
            ignore = true;
            sub.subscription.unsubscribe();
        };
    }, []);

    /* ---------- выбор филиала/услуги/мастера ---------- */
    const [branchId, setBranchId] = useState<string>('');

    const servicesByBranch = useMemo(
        () => services.filter((s) => s.branch_id === branchId),
        [services, branchId]
    );
    const staffByBranch = useMemo(
        () => staff.filter((m) => m.branch_id === branchId),
        [staff, branchId]
    );

    const [serviceId, setServiceId] = useState<string>('');
    const [staffId, setStaffId] = useState<string>('');
    const [restoredFromStorage, setRestoredFromStorage] = useState(false);

    // при смене филиала — сбрасываем выборы мастеров и услуг (если не восстановили состояние из localStorage)
    useEffect(() => {
        if (restoredFromStorage) return;
        // Сбрасываем выборы при смене филиала
        setStaffId('');
        setServiceId('');
    }, [branchId, restoredFromStorage]);

    /* ---------- сервисные навыки мастеров (service_staff) ---------- */
    const [serviceStaff, setServiceStaff] = useState<ServiceStaffRow[] | null>(null);
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
                console.warn('[service_staff] read error:', error.message);
                setServiceStaff(null); // нет доступа — UI живёт без фильтра по навыкам
            } else {
                setServiceStaff((data ?? []) as ServiceStaffRow[]);
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

    // Список мастеров: только по филиалу (без фильтрации по услуге)
    const staffFiltered = useMemo<Staff[]>(() => {
        return staffByBranch;
    }, [staffByBranch]);

    // Список услуг: по филиалу + по мастеру (если мастер выбран)
    const servicesFiltered = useMemo<Service[]>(() => {
        const base = servicesByBranch;
        if (!staffId) return []; // Если мастер не выбран, не показываем услуги
        if (!serviceToStaffMap) return []; // Если нет данных о связи услуга-мастер, не показываем услуги (безопаснее)
        // Находим все услуги, которые делает выбранный мастер
        const servicesForStaff = new Set<string>();
        for (const [serviceId, staffSet] of serviceToStaffMap.entries()) {
            if (staffSet.has(staffId)) {
                servicesForStaff.add(serviceId);
            }
        }
        return base.filter((s) => servicesForStaff.has(s.id));
    }, [servicesByBranch, staffId, serviceToStaffMap]);

    // при смене мастера — сбрасываем выбор услуги, если текущая не подходит
    useEffect(() => {
        if (!staffId) {
            setServiceId('');
            return;
        }
        // Если выбранная услуга не подходит под нового мастера — сбрасываем выбор
        if (serviceId) {
            const isServiceValid = servicesFiltered.some((s) => s.id === serviceId);
            if (!isServiceValid) {
                setServiceId('');
            }
        }
    }, [staffId, servicesFiltered, serviceId]);

    /* ---------- дата и слоты через RPC get_free_slots_service_day_v2 ---------- */
    const [day, setDay] = useState<Date>(todayTz());
    const dayStr = formatInTimeZone(day, TZ, 'yyyy-MM-dd');
    const todayStr = formatInTimeZone(todayTz(), TZ, 'yyyy-MM-dd');
    const maxStr = formatInTimeZone(addDays(todayTz(), 60), TZ, 'yyyy-MM-dd');

    const [slots, setSlots] = useState<Slot[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slotsError, setSlotsError] = useState<string | null>(null);
    const [slotsRefreshKey, setSlotsRefreshKey] = useState(0); // Ключ для принудительного обновления

    // Брони клиента в этом бизнесе на выбранный день (для мягкого уведомления)
    const [clientBookingsCount, setClientBookingsCount] = useState<number | null>(null);
    const [clientBookingsLoading, setClientBookingsLoading] = useState(false);

    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!serviceId || !staffId || !dayStr) {
                setSlots([]);
                return;
            }
            
            // Проверка: если у сотрудника нет услуг для выбранной услуги, не загружаем слоты
            if (serviceToStaffMap) {
                const allowedStaff = serviceToStaffMap.get(serviceId);
                if (!allowedStaff?.has(staffId)) {
                    setSlots([]);
                    setSlotsError('Выбранный мастер не выполняет эту услугу');
                    setSlotsLoading(false);
                    return;
                }
            }
            
            setSlotsLoading(true);
            setSlotsError(null);
            try {
                // Добавляем timestamp для предотвращения кэширования
                const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
                    p_biz_id: biz.id,
                    p_service_id: serviceId,
                    p_day: dayStr,
                    p_per_staff: 400,
                    p_step_min: 15,
                });
                if (ignore) return;
                if (error) {
                    console.error('[get_free_slots_service_day_v2] error:', error);
                    setSlots([]);
                    setSlotsError(error.message);
                    return;
                }
                const all = (data ?? []) as Slot[];
                const now = new Date();
                const minTime = addMinutes(now, 30); // минимум через 30 минут от текущего времени
                let filtered = all.filter(
                    (s) => s.staff_id === staffId && 
                           s.branch_id === branchId &&
                           new Date(s.start_at) > minTime
                );
                
                // Дополнительная проверка: исключаем слоты, которые уже забронированы
                // (на случай, если RPC не учитывает все статусы)
                try {
                    // Запрашиваем все брони для этого мастера и филиала на выбранный день
                    // Используем более широкий диапазон, чтобы захватить все брони, которые могут пересекаться
                    // Бронь в базе хранится в UTC, поэтому нужно искать по UTC дате
                    // dayStr = '2025-12-30' в локальной таймзоне
                    // В UTC это может быть другой день, поэтому используем широкий диапазон
                    const dayStartUTC = new Date(dayStr + 'T00:00:00Z'); // Начало дня в UTC
                    const dayEndUTC = new Date(dayStr + 'T23:59:59.999Z'); // Конец дня в UTC
                    // Добавляем запас в 12 часов в обе стороны для учета таймзон
                    const searchStart = new Date(dayStartUTC.getTime() - 12 * 60 * 60 * 1000);
                    const searchEnd = new Date(dayEndUTC.getTime() + 12 * 60 * 60 * 1000);
                    
                    const { data: existingBookings, error: bookingsError } = await supabase
                        .from('bookings')
                        .select('start_at, end_at, status')
                        .eq('staff_id', staffId)
                        .eq('branch_id', branchId)
                        .in('status', ['hold', 'confirmed', 'paid']) // исключаем cancelled и no_show
                        .gte('start_at', searchStart.toISOString())
                        .lte('end_at', searchEnd.toISOString());
                    
                    if (bookingsError) {
                        console.error('[filter bookings] query error:', bookingsError);
                    }
                    
                    if (existingBookings && existingBookings.length > 0) {
                        // console.log(`[filter bookings] Found ${existingBookings.length} existing bookings for ${dayStr}`, existingBookings);
                        
                        // Исключаем слоты, которые пересекаются с существующими бронями
                        // Все времена в UTC, поэтому сравнение корректно
                        const beforeFilter = filtered.length;
                        filtered = filtered.filter(slot => {
                            const slotStart = new Date(slot.start_at);
                            const slotEnd = new Date(slot.end_at);
                            
                            const overlaps = existingBookings.some(booking => {
                                const bookingStart = new Date(booking.start_at);
                                const bookingEnd = new Date(booking.end_at);
                                // Проверяем пересечение: слот не должен пересекаться с бронями
                                const hasOverlap = slotStart < bookingEnd && slotEnd > bookingStart;
                                if (hasOverlap) {
                                    // console.log(`[filter bookings] Slot ${slot.start_at} (${toLabel(slotStart)}) overlaps with booking ${booking.start_at} (${toLabel(bookingStart)}) - ${booking.end_at} (${toLabel(bookingEnd)})`);
                                }
                                return hasOverlap;
                            });
                            
                            return !overlaps;
                        });
                        
                        const afterFilter = filtered.length;
                        if (beforeFilter !== afterFilter) {
                            // console.log(`[filter bookings] Filtered out ${beforeFilter - afterFilter} slots (from ${beforeFilter} to ${afterFilter})`);
                        }
                    } else {
                        // console.log(`[filter bookings] No existing bookings found for ${dayStr}`);
                    }
                } catch (e) {
                    console.error('[filter bookings] error:', e);
                    // Игнорируем ошибку, используем данные от RPC
                }
                
                setSlots(filtered);
            } catch (e) {
                if (ignore) return;
                console.error('[get_free_slots_service_day_v2] catch:', e);
                setSlots([]);
                setSlotsError(fmtErr(e));
            } finally {
                if (!ignore) setSlotsLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [biz.id, serviceId, staffId, branchId, dayStr, slotsRefreshKey, serviceToStaffMap]);

    // Проверяем, есть ли уже записи клиента в этом бизнесе на выбранный день
    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!isAuthed) {
                if (!ignore) {
                    setClientBookingsCount(null);
                    setClientBookingsLoading(false);
                }
                return;
            }

            setClientBookingsLoading(true);
            try {
                const { data: auth } = await supabase.auth.getUser();
                const userId = auth.user?.id;
                if (!userId) {
                    if (!ignore) setClientBookingsCount(null);
                    return;
                }

                // Ищем все брони клиента в этом бизнесе на выбранный день
                const dayStartUTC = new Date(dayStr + 'T00:00:00Z');
                const dayEndUTC = new Date(dayStr + 'T23:59:59.999Z');
                const searchStart = new Date(dayStartUTC.getTime() - 12 * 60 * 60 * 1000);
                const searchEnd = new Date(dayEndUTC.getTime() + 12 * 60 * 60 * 1000);

                const { data, error } = await supabase
                    .from('bookings')
                    .select('id')
                    .eq('biz_id', biz.id)
                    .eq('client_id', userId)
                    .in('status', ['hold', 'confirmed', 'paid'])
                    .gte('start_at', searchStart.toISOString())
                    .lte('start_at', searchEnd.toISOString());

                if (ignore) return;
                if (error) {
                    console.warn('[client bookings warning] failed to load bookings:', error.message);
                    setClientBookingsCount(null);
                } else {
                    setClientBookingsCount((data ?? []).length);
                }
            } catch (e) {
                if (!ignore) {
                    console.warn('[client bookings warning] unexpected error:', e);
                    setClientBookingsCount(null);
                }
            } finally {
                if (!ignore) setClientBookingsLoading(false);
            }
        })();

        return () => {
            ignore = true;
        };
    }, [isAuthed, biz.id, dayStr]);

    // Обновляем список слотов при возврате на страницу (например, через кнопку "Назад")
    // Используем useRef для хранения предыдущих значений, чтобы избежать лишних обновлений
    useEffect(() => {
        let lastUpdate = 0;
        const handleVisibilityChange = () => {
            // Ограничиваем частоту обновлений (не чаще раза в 2 секунды)
            const now = Date.now();
            if (now - lastUpdate < 2000) return;
            
            if (document.visibilityState === 'visible' && serviceId && staffId && dayStr) {
                lastUpdate = now;
                // Обновляем список слотов при возврате на страницу
                setSlotsRefreshKey((k) => k + 1);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [serviceId, staffId, dayStr]);

    /* ---------- hold / confirm и таймер ---------- */
    const [holding, setHolding] = useState<{ bookingId: string; until: number; slotLabel: string } | null>(null);

    // Восстановление состояния после авторизации (localStorage)
    useEffect(() => {
        if (restoredFromStorage) return;
        if (typeof window === 'undefined') return;
        
        // Используем useMemo для создания стабильных ссылок на массивы
        const branchIds = new Set(branches.map((b) => b.id));
        const serviceIds = new Set(services.map((s) => s.id));
        const staffIds = new Set(staff.map((m) => m.id));
        
        try {
            const key = `booking_state_${biz.id}`;
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                setRestoredFromStorage(true);
                return;
            }
            const parsed = JSON.parse(raw) as {
                branchId?: string;
                serviceId?: string;
                staffId?: string;
                day?: string;
                step?: number;
            };

            if (parsed.branchId && branchIds.has(parsed.branchId)) {
                setBranchId(parsed.branchId);
            }
            if (parsed.serviceId && serviceIds.has(parsed.serviceId)) {
                setServiceId(parsed.serviceId);
            }
            // Восстанавливаем мастера только если он валиден (будет проверен в useEffect ниже)
            if (parsed.staffId && staffIds.has(parsed.staffId)) {
                setStaffId(parsed.staffId);
            }
            if (parsed.day) {
                try {
                    setDay(dateAtTz(parsed.day, '00:00'));
                } catch {
                    // ignore
                }
            }
            if (parsed.step && parsed.step >= 1 && parsed.step <= 4) {
                setStep(parsed.step);
            }

            window.localStorage.removeItem(key);
        } catch (e) {
            console.error('restore booking state failed', e);
        } finally {
            setRestoredFromStorage(true);
        }
    }, [biz.id, restoredFromStorage]); // Убрали branches, services, staff из зависимостей, чтобы избежать бесконечных ререндеров
    const [loading, setLoading] = useState(false);

    const service = useMemo(
        () => servicesByBranch.find((s) => s.id === serviceId) ?? null,
        [servicesByBranch, serviceId]
    );

    async function hold(t: Date) {
        if (!service) return alert('Выбери услугу');
        if (!staffId) return alert('Выбери мастера');
        if (!branchId) return alert('Выбери филиал');

        // Требуем авторизацию для бронирования
        if (!isAuthed) {
            redirectToAuth();
            return;
        }

        setLoading(true);
        try {
            const startISO = formatInTimeZone(t, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
            const { data, error } = await supabase.rpc('hold_slot', {
                p_biz_id: biz.id,
                p_branch_id: branchId,
                p_service_id: service.id,
                p_staff_id: staffId,
                p_start: startISO,
            });

            if (error) {
                console.error('[hold_slot] error:', error);
                alert(fmtErr(error));
                return;
            }

            const bookingId = String(data);
            setHolding({ bookingId, until: Date.now() + 120_000, slotLabel: toLabel(t) });

            fetch('/api/notify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ type: 'hold', booking_id: bookingId }),
            }).catch(() => {});
        } catch (e) {
            console.error('[hold_slot] catch:', e);
            alert(fmtErr(e));
        } finally {
            setLoading(false);
        }
    }

    async function confirm() {
        if (!isAuthed || !holding) return;
        setLoading(true);
        try {
            const { error } = await supabase.rpc('confirm_booking', { p_booking_id: holding.bookingId });
            if (error) {
                console.error('[confirm_booking] error:', error);
                alert(fmtErr(error));
                return;
            }

            await fetch('/api/notify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ type: 'confirm', booking_id: holding.bookingId }),
            });

            location.href = `/booking/${holding.bookingId}`;
        } catch (e) {
            console.error('[confirm_booking] catch:', e);
            alert(fmtErr(e));
        } finally {
            setLoading(false);
        }
    }

    // таймер
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t0) => t0 + 1), 500);
        return () => clearInterval(id);
    }, []);
    const leftSec = Math.max(0, holding ? Math.ceil((holding.until - Date.now()) / 1000) : 0);
    void tick;

    /* ---------- производные значения для отображения ---------- */
    const branch = branches.find((b) => b.id === branchId) ?? null;
    const staffCurrent = staff.find((m) => m.id === staffId) ?? null;
    const serviceCurrent = service;

    function redirectToAuth() {
        if (typeof window === 'undefined') return;
        try {
            const key = `booking_state_${biz.id}`;
            const payload = {
                branchId,
                serviceId,
                staffId,
                day: dayStr,
                step,
            };
            window.localStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {
            console.error('save booking state failed', e);
        }
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/auth/sign-in?mode=phone&redirect=${redirect}`;
    }

    const dayLabel = `${format(day, 'dd.MM.yyyy')} (${format(day, 'EEEE')})`;

    /* ---------- пошаговый визард ---------- */
    const [step, setStep] = useState<number>(1);
    const totalSteps = 4;

    const stepsMeta = [
        { id: 1, label: t('booking.step.branch', 'Филиал') },
        { id: 2, label: t('booking.step.master', 'Мастер') },
        { id: 3, label: t('booking.step.service', 'Услуга') },
        { id: 4, label: t('booking.step.dayTime', 'День и время') },
    ] as const;

    // Валидация для перехода к следующему шагу
    const canGoNext = useMemo(() => {
        if (step >= totalSteps) return false;
        
        // Шаг 1 -> 2: должен быть выбран филиал
        if (step === 1) return !!branchId;
        
        // Шаг 2 -> 3: должен быть выбран мастер
        if (step === 2) return !!staffId;
        
        // Шаг 3 -> 4: должна быть выбрана услуга И мастер должен делать эту услугу
        if (step === 3) {
            if (!serviceId || !staffId) return false;
            // Проверяем, что услуга есть в отфильтрованном списке
            const isServiceValid = servicesFiltered.some((s) => s.id === serviceId);
            if (!isServiceValid) return false;
            // Если есть данные о связи услуга-мастер, дополнительно проверяем
            if (serviceToStaffMap) {
                const allowedStaff = serviceToStaffMap.get(serviceId);
                return allowedStaff?.has(staffId) ?? false;
            }
            // Если данных нет, но услуга есть в отфильтрованном списке - разрешаем
            return true;
        }
        
        return true;
    }, [step, branchId, serviceId, staffId, serviceToStaffMap, totalSteps, servicesFiltered]);
    
    const canGoPrev = step > 1;

    /* ---------- UI ---------- */
    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
                <div className="space-y-1">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100">
                        {biz.name}
                    </h1>
                    {biz.address && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{biz.address}</p>
                    )}
                    {biz.phones?.length ? (
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                            {t('booking.phoneLabel', 'Телефон:')} {biz.phones.join(', ')}
                        </p>
                    ) : null}
                </div>

                {!isAuthed && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                        {t(
                            'booking.needAuth',
                            'Для бронирования необходимо войти или зарегистрироваться. Нажмите кнопку «Войти» вверху страницы.'
                        )}
                    </div>
                )}

                {/* Степпер по шагам */}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    {stepsMeta.map((s, index) => {
                        const isActive = s.id === step;
                        const isCompleted = s.id < step;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setStep(s.id)}
                                className="flex items-center gap-2"
                            >
                                <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                                        isActive
                                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                            : isCompleted
                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                            : 'border-gray-300 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300'
                                    }`}
                                >
                                    {isCompleted ? '✓' : s.id}
                                </div>
                                <span
                                    className={`text-[11px] font-medium ${
                                        isActive
                                            ? 'text-indigo-700 dark:text-indigo-300'
                                            : 'text-gray-600 dark:text-gray-300'
                                    }`}
                                >
                                    {index + 1}. {s.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                    <div className="space-y-4">
                        {/* Шаг 1: филиал */}
                        {step === 1 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Шаг 1. Выберите филиал
                                </h2>
                                {branches.length === 0 ? (
                                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                                        Нет активных филиалов.
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {branches.map((b) => {
                                            const active = b.id === branchId;
                                            return (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    onClick={() => setBranchId(b.id)}
                                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                                        active
                                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-100'
                                                            : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                                                    }`}
                                                >
                                                    {b.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Шаг 2: мастер */}
                        {step === 2 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Шаг 2. Мастер
                                </h2>
                                {staffFiltered.length === 0 ? (
                                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                                        В этом филиале пока нет активных сотрудников.
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {staffFiltered.map((m) => {
                                            const active = m.id === staffId;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setStaffId(m.id)}
                                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                                        active
                                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-100'
                                                            : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                                                    }`}
                                                >
                                                    {m.full_name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Шаг 3: услуга */}
                        {step === 3 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Шаг 3. Услуга
                                </h2>
                                {!staffId ? (
                                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                                        Сначала выберите мастера на шаге 2.
                                    </div>
                                ) : servicesFiltered.length === 0 ? (
                                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                                        У выбранного мастера пока нет назначенных услуг.
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-2">
                                            {servicesFiltered.map((s) => {
                                                const active = s.id === serviceId;
                                                const hasRange =
                                                    typeof s.price_from === 'number' &&
                                                    (typeof s.price_to === 'number'
                                                        ? s.price_to !== s.price_from
                                                        : false);
                                                return (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        onClick={() => setServiceId(s.id)}
                                                        className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                                                            active
                                                                ? 'border-indigo-600 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60'
                                                                : 'border-gray-200 bg-white hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                                                                {s.name_ru}
                                                            </div>
                                                            <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                                                {s.duration_min} мин
                                                            </div>
                                                        </div>
                                                        {(typeof s.price_from === 'number' ||
                                                            typeof s.price_to === 'number') && (
                                                            <div className="whitespace-nowrap text-right text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                {s.price_from}
                                                                {hasRange && s.price_to ? `–${s.price_to}` : ''}{' '}
                                                                сом
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {serviceCurrent && (
                                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                Продолжительность: {serviceCurrent.duration_min} мин.
                                                {serviceCurrent.price_from && (
                                                    <>
                                                        {' '}
                                                        Примерная стоимость:{' '}
                                                        {serviceCurrent.price_from}
                                                        {serviceCurrent.price_to &&
                                                        serviceCurrent.price_to !== serviceCurrent.price_from
                                                            ? `–${serviceCurrent.price_to}`
                                                            : ''}{' '}
                                                        сом.
                                                    </>
                                                )}
                                            </p>
                                        )}
                                    </>
                                )}
                            </section>
                        )}

                        {/* Шаг 4: день и время */}
                        {step === 4 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Шаг 4. День и время
                                </h2>

                                {/* Проверка: есть ли у выбранного сотрудника услуги для выбранной услуги */}
                                {serviceId && staffId && serviceToStaffMap && (() => {
                                    const allowedStaff = serviceToStaffMap.get(serviceId);
                                    const hasService = allowedStaff?.has(staffId) ?? false;
                                    if (!hasService) {
                                        return (
                                            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                                                <div className="flex items-start gap-2">
                                                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    <div>
                                                        <p className="font-medium">Выбранный мастер не выполняет эту услугу</p>
                                                        <p className="mt-1 text-amber-700 dark:text-amber-300">
                                                            Пожалуйста, вернитесь к шагу 3 и выберите другого мастера или выберите другую услугу.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Уведомление, если у клиента уже есть запись в этом бизнесе на выбранный день */}
                                {isAuthed && !clientBookingsLoading && clientBookingsCount && clientBookingsCount > 0 && (
                                    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                                        <div className="flex items-start gap-2">
                                            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                                />
                                            </svg>
                                            <div>
                                                <p className="font-medium">
                                                    У вас уже есть {clientBookingsCount === 1 ? 'одна активная запись' : `${clientBookingsCount} активных записей`}{' '}
                                                    в этом заведении на выбранный день.
                                                </p>
                                                <p className="mt-1 text-amber-700 dark:text-amber-300">
                                                    Вы всё равно можете оформить ещё одну запись, если это необходимо.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                                    <div className="flex-1 min-w-[200px]">
                                        <DatePickerPopover
                                            value={dayStr}
                                            min={todayStr}
                                            max={maxStr}
                                            onChange={(v) => {
                                                if (!v) return;
                                                setDay(dateAtTz(v, '00:00'));
                                            }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                                        onClick={() => setDay(todayTz())}
                                    >
                                        {t('booking.today', 'Сегодня')}
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                                        onClick={() => setDay(addDays(todayTz(), 1))}
                                    >
                                        {t('booking.tomorrow', 'Завтра')}
                                    </button>
                                </div>

                                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Свободные слоты
                                </h3>
                                {slotsLoading && (
                                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                        Загружаем свободные слоты...
                                    </div>
                                )}
                                {!slotsLoading && slotsError && (
                                    <div className="rounded-lg border border-dashed border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
                                        {slotsError}
                                    </div>
                                )}
                                {!slotsLoading && !slotsError && slots.length === 0 && (
                                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                        Нет свободных окон на этот день. Попробуйте выбрать другой день или мастера.
                                    </div>
                                )}
                                {!slotsLoading && !slotsError && slots.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {slots.map((s) => {
                                            const d = new Date(s.start_at);
                                            return (
                                                <button
                                                    key={s.start_at}
                                                    disabled={loading}
                                                    className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm transition hover:border-indigo-500 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40"
                                                    onClick={() => hold(d)}
                                                >
                                                    {toLabel(d)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Навигация по шагам */}
                        <div className="flex justify-between pt-1 text-xs">
                            <button
                                type="button"
                                disabled={!canGoPrev}
                                onClick={() => canGoPrev && setStep(step - 1)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                    canGoPrev
                                        ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'
                                        : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed'
                                }`}
                            >
                                {t('booking.nav.back', '← Назад')}
                            </button>
                            <button
                                type="button"
                                disabled={!canGoNext}
                                onClick={() => canGoNext && setStep(step + 1)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                    canGoNext
                                        ? 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 dark:border-indigo-400'
                                        : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed'
                                }`}
                            >
                                {step === totalSteps - 1
                                    ? t('booking.nav.next', 'К выбору времени →')
                                    : t('booking.nav.next', 'Далее →')}
                            </button>
                        </div>
                    </div>

                    {/* Корзина / итог */}
                    <aside className="space-y-3 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Ваша запись
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Шаги слева → выберите мастера, услугу, день и время. Здесь вы увидите итог перед
                            подтверждением.
                        </p>

                        <div className="mt-2 space-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">Филиал:</span>
                                <span className="font-medium">{branch ? branch.name : 'Не выбран'}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">Услуга:</span>
                                <span className="text-right font-medium">
                                    {serviceCurrent ? serviceCurrent.name_ru : 'Не выбрана'}
                                </span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">Мастер:</span>
                                <span className="text-right font-medium">
                                    {staffCurrent ? staffCurrent.full_name : 'Не выбран'}
                                </span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">День:</span>
                                <span className="text-right font-medium">{dayLabel}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">Время:</span>
                                <span className="text-right font-medium">
                                    {holding ? holding.slotLabel : 'Выберите слот'}
                                </span>
                            </div>
                            {serviceCurrent?.price_from && (
                                <div className="mt-1 flex justify-between gap-2 border-t border-dashed border-gray-300 pt-1 dark:border-gray-700">
                                    <span className="text-gray-500">Ориентировочная стоимость:</span>
                                    <span className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                        {serviceCurrent.price_from}
                                        {serviceCurrent.price_to &&
                                        serviceCurrent.price_to !== serviceCurrent.price_from
                                            ? `–${serviceCurrent.price_to}`
                                            : ''}{' '}
                                        сом
                                    </span>
                                </div>
                            )}
                        </div>

                        {!holding && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {!isAuthed ? (
                                    <span>Для бронирования необходимо войти. Нажмите кнопку «Войти» вверху страницы.</span>
                                ) : (
                                    <span>Сначала выберите свободный слот, затем вы сможете подтвердить бронь.</span>
                                )}
                            </div>
                        )}

                        {holding && leftSec > 0 && (
                            <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-100">
                                <div className="flex items-center justify-between">
                                    <span>
                                        Слот удержан ещё{' '}
                                        <b>
                                            {leftSec}
                                        </b>{' '}
                                        сек.
                                    </span>
                                </div>
                                {isAuthed ? (
                                    <button
                                        className="mt-1 w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                                        onClick={confirm}
                                        disabled={loading}
                                    >
                                        Подтвердить бронь
                                    </button>
                                ) : (
                                    <button
                                        className="mt-1 w-full rounded-lg border border-indigo-400 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-900 shadow-sm hover:bg-indigo-50 dark:bg-indigo-900 dark:text-indigo-50 dark:hover:bg-indigo-800"
                                        onClick={redirectToAuth}
                                    >
                                        Войти, чтобы подтвердить
                                    </button>
                                )}
                                <div className="text-[11px] text-indigo-900/80 dark:text-indigo-100/80">
                                    Пока без онлайн-оплаты. После добавления оплаты бронь будет подтверждаться
                                    автоматически.
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </main>
    );
}
