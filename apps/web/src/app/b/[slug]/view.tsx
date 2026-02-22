// apps/web/src/app/b/[slug]/view.tsx
'use client';

import { addDays, format } from 'date-fns';
import { enGB } from 'date-fns/locale/en-GB';
import { ru } from 'date-fns/locale/ru';
import { formatInTimeZone } from 'date-fns-tz';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AuthChoiceModal } from './components/AuthChoiceModal';
import { BookingHeader } from './components/BookingHeader';
import { BookingSteps } from './components/BookingSteps';
import { BookingSummary } from './components/BookingSummary';
import { BranchSelector } from './components/BranchSelector';
import { GuestBookingModal } from './components/GuestBookingModal';
import { PromotionsList } from './components/PromotionsList';
import { ServiceSelector } from './components/ServiceSelector';
import { SlotPicker } from './components/SlotPicker';
import { StaffSelector } from './components/StaffSelector';
import { useBookingCreation } from './hooks/useBookingCreation';
import { useBranchPromotions, useClientBookings, useServiceStaff } from './hooks/useBookingData';
import { useBookingSteps } from './hooks/useBookingSteps';
import { useGuestBooking } from './hooks/useGuestBooking';
import { useServicesFilter } from './hooks/useServicesFilter';
import { useSlotsLoader } from './hooks/useSlotsLoader';
import { useTemporaryTransfers } from './hooks/useTemporaryTransfers';
import type { Data, Service, ServiceStaffRow, Slot, Staff } from './types';

import {useLanguage} from '@/app/_components/i18n/LanguageProvider';
import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import { logDebug, logWarn, logError } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';
import { todayTz, dateAtTz, getBusinessTimezone } from '@/lib/time';
import { transliterate } from '@/lib/transliterate';
import { trackFunnelEvent, getSessionId } from '@/lib/funnelEvents';

// Используем безопасное логирование из @/lib/log
// debugLog и debugWarn удалены - используйте logDebug и logWarn из @/lib/log


export default function BookingForm({ data }: { data: Data }) {
    const { biz, branches, services, staff, promotions = [] } = data;
    const {t, locale} = useLanguage();
    const searchParams = useSearchParams();
    
    // Функции для форматирования названий (используем нужный язык, если доступен)
    const formatBranchName = (name: string): string => {
        // Для филиалов используется транслитерация, так как нет отдельных полей для языков
        if (locale === 'en') {
            return transliterate(name);
        }
        return name;
    };
    
    const formatServiceName = (service: Service): string => {
        // Используем поле для выбранного языка, если оно заполнено
        if (locale === 'en' && service.name_en) {
            return service.name_en;
        }
        if (locale === 'ky' && service.name_ky) {
            return service.name_ky;
        }
        // Если поля для выбранного языка нет, используем транслитерацию для английского
        if (locale === 'en') {
            return transliterate(service.name_ru);
        }
        // Для русского и кыргызского (если name_ky нет) используем name_ru
        return service.name_ru;
    };
    
    const formatStaffName = (name: string): string => {
        // Транслитерируем имя мастера для английского языка
        if (locale === 'en') {
            return transliterate(name);
        }
        return name;
    };

    // Получаем локаль для форматирования дат
    const dateLocale = useMemo(() => {
        if (locale === 'en') {
            return enGB;
        }
        // Для русского и кыргызского используем русскую локаль
        // (в date-fns нет встроенной киргизской локали)
        return ru;
    }, [locale]);

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
    // Читаем параметр branch из URL при первой загрузке
    const branchFromUrl = searchParams.get('branch');
    const [branchId, setBranchId] = useState<string>('');
    const [initialBranchSet, setInitialBranchSet] = useState(false);

    // Устанавливаем филиал из URL при первой загрузке
    useEffect(() => {
        if (!initialBranchSet && branchFromUrl) {
            // Проверяем, что филиал существует в списке
            const branchExists = branches.some((b) => b.id === branchFromUrl);
            if (branchExists) {
                setBranchId(branchFromUrl);
                setInitialBranchSet(true);
            }
        } else if (!initialBranchSet && !branchFromUrl) {
            setInitialBranchSet(true);
        }
    }, [branchFromUrl, branches, initialBranchSet]);

    // Отслеживание просмотра бизнеса
    useEffect(() => {
        if (typeof window !== 'undefined') {
            trackFunnelEvent({
                event_type: 'business_view',
                source: 'public',
                biz_id: biz.id,
                session_id: getSessionId(),
                user_agent: navigator.userAgent,
                referrer: document.referrer || null,
            });
        }
    }, [biz.id]);

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
    
    // Загружаем активные акции филиала с кэшированием через React Query
    const { data: branchPromotions = [], isLoading: promotionsLoading } = useBranchPromotions(branchId || null);

    // при смене филиала — сбрасываем выборы мастеров и услуг (если не восстановили состояние из localStorage)
    useEffect(() => {
        if (restoredFromStorage) return;
        // Сбрасываем выборы при смене филиала
        setStaffId('');
        setServiceId('');
    }, [branchId, restoredFromStorage]);

    /* ---------- сервисные навыки мастеров (service_staff) ---------- */
    // Загружаем связи услуга-мастер с кэшированием через React Query
    const staffIds = useMemo(() => staff.map((s) => s.id), [staff]);
    const { data: serviceStaffData, isLoading: serviceStaffLoading } = useServiceStaff(biz.id, staffIds);
    const serviceStaff: ServiceStaffRow[] | null = serviceStaffLoading ? null : (serviceStaffData || null);

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

    /* ---------- дата и слоты через RPC get_free_slots_service_day_v2 ---------- */
    const businessTz = getBusinessTimezone(biz.tz);
    const [day, setDay] = useState<Date>(todayTz(businessTz));
    const dayStr = formatInTimeZone(day, businessTz, 'yyyy-MM-dd');
    const todayStr = formatInTimeZone(todayTz(businessTz), businessTz, 'yyyy-MM-dd');
    const maxStr = formatInTimeZone(addDays(todayTz(businessTz), 60), businessTz, 'yyyy-MM-dd');

    /* ---------- временные переводы сотрудников (staff_schedule_rules) ---------- */
    const { temporaryTransfers } = useTemporaryTransfers({
        branchId,
        bizId: biz.id,
        staff,
    });

    /* ---------- фильтрация услуг ---------- */
    const servicesFiltered = useServicesFilter({
        services,
        servicesByBranch,
        staffId,
        branchId,
        dayStr,
        serviceToStaffMap,
        temporaryTransfers,
    });

    // при смене мастера или даты — сбрасываем выбор услуги, если текущая не подходит
    useEffect(() => {
        if (!staffId || !dayStr) {
            if (!staffId) logDebug('Booking', 'Staff cleared, clearing service');
            if (!dayStr) logDebug('Booking', 'Day cleared, clearing service');
            setServiceId('');
            return;
        }
        // Если выбранная услуга не подходит под нового мастера или дату — сбрасываем выбор
        if (serviceId) {
            const isServiceValid = servicesFiltered.some((s) => s.id === serviceId);
            logDebug('Booking', 'Checking service validity after staff/day change', { 
                serviceId, 
                staffId, 
                dayStr,
                isServiceValid, 
                servicesFilteredCount: servicesFiltered.length, 
                servicesFiltered: servicesFiltered.map(s => ({ id: s.id, name: s.name_ru })) 
            });
            if (!isServiceValid) {
                logWarn('Booking', 'Service is not valid for current staff/day, clearing serviceId');
                setServiceId('');
            }
        }
    }, [staffId, dayStr, servicesFiltered, serviceId]);


    // Список мастеров: по филиалу + временные переводы В этот филиал на выбранную дату
    // Исключаем мастеров, которые временно переведены В ДРУГОЙ филиал на эту дату
    const staffFiltered = useMemo<Staff[]>(() => {
        if (!branchId) return [];
        
        // Основные сотрудники филиала
        const mainStaff = staffByBranch;
        const mainStaffIds = new Set(mainStaff.map(s => s.id));
        
        // Если дата выбрана, проверяем временные переводы
        if (dayStr) {
            // Временно переведенные В выбранный филиал на эту дату
            const transfersToThisBranch = temporaryTransfers.filter((t: { staff_id: string; branch_id: string; date: string }) => 
                t.date === dayStr && t.branch_id === branchId
            );
            const tempStaffIdsToThisBranch = new Set(transfersToThisBranch.map((t: { staff_id: string; branch_id: string; date: string }) => t.staff_id));
            
            // Мастера, временно переведенные В ДРУГОЙ филиал на эту дату (их нужно исключить из основного филиала)
            const transfersToOtherBranch = temporaryTransfers.filter((t: { staff_id: string; branch_id: string; date: string }) => 
                t.date === dayStr && t.branch_id !== branchId
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
        }
        
        // Дата не выбрана - показываем только основных сотрудников филиала
        // (не показываем временно переведенных, так как не знаем дату)
        return mainStaff;
    }, [staffByBranch, staff, branchId, temporaryTransfers, dayStr]);

    // при смене даты — сбрасываем выборы мастеров и услуг, так как список мастеров может измениться
    useEffect(() => {
        if (restoredFromStorage) return;
        // Сбрасываем выборы при смене даты
        setStaffId('');
        setServiceId('');
    }, [dayStr, restoredFromStorage]);

    const [slotsRefreshKey, setSlotsRefreshKey] = useState(0); // Ключ для принудительного обновления

    // Брони клиента в этом бизнесе на выбранный день (для мягкого уведомления)
    // Используем React Query для кэширования
    const { data: clientBookingsCount = null, isLoading: clientBookingsLoading } = useClientBookings(
        biz.id,
        dayStr || null,
        isAuthed
    );

    /* ---------- загрузка слотов ---------- */
    const { slots: slotsFromHook, loading: slotsLoading, error: slotsError } = useSlotsLoader({
        serviceId,
        staffId,
        dayStr,
        branchId,
        bizId: biz.id,
        servicesFiltered,
        serviceStaff,
        temporaryTransfers,
        staff,
        t,
        slotsRefreshKey,
    });

    // Дополнительная фильтрация слотов по существующим броням
    // (на случай, если RPC не учитывает все статусы)
    const [slots, setSlots] = useState<Slot[]>([]);
    useEffect(() => {
        if (!slotsFromHook.length) {
            setSlots([]);
            return;
        }

        let ignore = false;
        (async () => {
            try {
                // Определяем targetBranchId для временных переводов
                const isTemporaryTransfer = dayStr && temporaryTransfers.some(
                    (t) => t.staff_id === staffId && t.date === dayStr
                );
                const staffCurrent = staff.find((m) => m.id === staffId);
                let targetBranchId = branchId;
                if (isTemporaryTransfer && dayStr) {
                    const tempTransfer = temporaryTransfers.find(
                        (t) => t.staff_id === staffId && t.date === dayStr
                    );
                    if (tempTransfer) {
                        targetBranchId = tempTransfer.branch_id;
                    }
                }

                // Запрашиваем все брони для этого мастера и филиала на выбранный день
                const dayStartUTC = new Date(dayStr + 'T00:00:00Z');
                const dayEndUTC = new Date(dayStr + 'T23:59:59.999Z');
                const searchStart = new Date(dayStartUTC.getTime() - 12 * 60 * 60 * 1000);
                const searchEnd = new Date(dayEndUTC.getTime() + 12 * 60 * 60 * 1000);

                // Запрашиваем все брони для этого мастера и филиала на выбранный день
                // Включаем все статусы кроме cancelled, чтобы точно исключить занятые слоты
                const { data: existingBookings, error: bookingsError } = await supabase
                    .from('bookings')
                    .select('start_at, end_at, status')
                    .eq('staff_id', staffId)
                    .eq('branch_id', targetBranchId)
                    .not('status', 'eq', 'cancelled')  // Исключаем только отмененные
                    .gte('start_at', searchStart.toISOString())
                    .lte('end_at', searchEnd.toISOString());

                if (ignore) return;

                if (bookingsError) {
                    logWarn('Booking', 'Error loading bookings for filtering', bookingsError);
                    setSlots(slotsFromHook);
                    return;
                }

                if (existingBookings && existingBookings.length > 0) {
                    logDebug('Booking', 'Filtering slots, found existing bookings', { count: existingBookings.length });
                    const filtered = slotsFromHook.filter((slot) => {
                        const slotStart = new Date(slot.start_at);
                        const slotEnd = new Date(slot.end_at);

                        const overlaps = existingBookings.some((booking) => {
                            const bookingStart = new Date(booking.start_at);
                            const bookingEnd = new Date(booking.end_at);
                            // Проверяем пересечение временных интервалов
                            const hasOverlap = slotStart < bookingEnd && slotEnd > bookingStart;
                            if (hasOverlap) {
                                logDebug('Booking', 'Slot overlaps with booking', {
                                    slot: { start: slotStart.toISOString(), end: slotEnd.toISOString() },
                                    booking: { start: bookingStart.toISOString(), end: bookingEnd.toISOString(), status: booking.status },
                                });
                            }
                            return hasOverlap;
                        });

                        return !overlaps;
                    });
                    logDebug('Booking', 'Filtered slots', { filtered: filtered.length, total: slotsFromHook.length });
                    setSlots(filtered);
                } else {
                    logDebug('Booking', 'No existing bookings found, showing all slots');
                    setSlots(slotsFromHook);
                }
            } catch (e) {
                if (!ignore) {
                    logWarn('Booking', 'Error filtering slots by bookings', e);
                    setSlots(slotsFromHook);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, [slotsFromHook, staffId, branchId, dayStr, temporaryTransfers, staff]);


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

    /* ---------- создание бронирования ---------- */
    // Создаем стабильные ссылки на Set'ы ID для валидации восстановленных значений
    const branchIds = useMemo(() => new Set(branches.map((b) => b.id)), [branches]);
    const serviceIds = useMemo(() => new Set(services.map((s) => s.id)), [services]);
    const staffIdSet = useMemo(() => new Set(staff.map((m) => m.id)), [staff]);
    
    // Восстановление состояния после авторизации (localStorage)
    useEffect(() => {
        if (restoredFromStorage) return;
        if (typeof window === 'undefined') return;
        
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
            if (parsed.staffId && staffIdSet.has(parsed.staffId)) {
                setStaffId(parsed.staffId);
            }
            if (parsed.day) {
                try {
                    setDay(dateAtTz(parsed.day, '00:00', businessTz));
                } catch {
                    // ignore
                }
            }
            // шаг восстанавливаем через useBookingSteps чуть ниже (через payload в localStorage)

            window.localStorage.removeItem(key);
        } catch (e) {
            logError('Booking', 'restore booking state failed', e);
        } finally {
            setRestoredFromStorage(true);
        }
    }, [biz.id, restoredFromStorage, branchIds, serviceIds, staffIds]);

    const service = useMemo(
        () => {
            // Ищем услугу сначала в отфильтрованных услугах (для временно переведенного мастера)
            // Если не найдена, ищем во всех услугах филиала
            // Если не найдена, ищем во всех услугах
            const found = servicesFiltered.find((s) => s.id === serviceId) 
                ?? servicesByBranch.find((s) => s.id === serviceId)
                ?? services.find((s) => s.id === serviceId);
            logDebug('Booking', 'Finding service', { 
                serviceId, 
                found: found ? found.name_ru : null, 
                foundInFiltered: !!servicesFiltered.find((s) => s.id === serviceId),
                foundInBranch: !!servicesByBranch.find((s) => s.id === serviceId),
                foundInAll: !!services.find((s) => s.id === serviceId)
            });
            return found ?? null;
        },
        [servicesFiltered, servicesByBranch, services, serviceId]
    );

    // Используем хуки для создания бронирования
    const guestBooking = useGuestBooking({
        bizId: biz.id,
        service,
        staffId,
        branchId,
        t,
        onBookingCreated: () => {
            // Обновляем кэш слотов после создания бронирования
            setSlotsRefreshKey((k) => k + 1);
        },
    });

    // Состояние для модального окна выбора (авторизация или запись без регистрации)
    const [authChoiceModalOpen, setAuthChoiceModalOpen] = useState(false);
    const [selectedSlotTime, setSelectedSlotTime] = useState<Date | null>(null);
    const [selectedSlotStaffId, setSelectedSlotStaffId] = useState<string | null>(null);

    const { createBooking, loading: bookingLoading } = useBookingCreation({
        bizId: biz.id,
        branchId,
        service,
        staffId,
        isAuthed,
        t,
        onAuthChoiceRequest: (slotTime, slotStaffId) => {
            setSelectedSlotTime(slotTime);
            setSelectedSlotStaffId(slotStaffId || null);
            // Сохраняем staff_id из слота для использования в модальном окне
            if (slotStaffId && staffId === 'any') {
                setStaffId(slotStaffId);
            }
            setAuthChoiceModalOpen(true);
        },
        onStaffIdChange: (newStaffId) => {
            setStaffId(newStaffId);
        },
        onBookingCreated: () => {
            // Обновляем кэш слотов после создания бронирования
            setSlotsRefreshKey((k) => k + 1);
        },
    });

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
            logError('Booking', 'save booking state failed', e);
        }
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/auth/sign-in?mode=phone&redirect=${redirect}`;
    }

    const dayLabel = useMemo(() => {
        const dateStr = format(day, 'dd.MM.yyyy', { locale: dateLocale });
        const weekdayStr = format(day, 'EEEE', { locale: dateLocale });
        return `${dateStr} (${weekdayStr})`;
    }, [day, dateLocale]);

    /* ---------- пошаговый визард ---------- */
    const { step, stepsMeta, canGoNext, canGoPrev, goNext, goPrev, totalSteps } = useBookingSteps({
        branchId,
        dayStr,
        staffId,
        serviceId,
        servicesFiltered,
        t,
    });

    /* ---------- UI ---------- */
    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
                <BookingHeader biz={biz} t={t} />

                {!isAuthed && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                        {t(
                            'booking.needAuth',
                            'Для бронирования необходимо войти или зарегистрироваться. Нажмите кнопку «Войти» вверху страницы.'
                        )}
                    </div>
                )}
                
                {branchId && branchPromotions.length > 0 && (
                    <PromotionsList promotions={branchPromotions} t={t} />
                )}

                <BookingSteps stepsMeta={stepsMeta} step={step} canGoNext={canGoNext} goPrev={goPrev} />

                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                    <div className="space-y-4">
                        {/* Шаг 1: филиал */}
                        {step === 1 && (
                            <BranchSelector
                                branches={branches}
                                selectedBranchId={branchId}
                                onSelect={(id) => {
                                    setBranchId(id);
                                    trackFunnelEvent({
                                        event_type: 'branch_select',
                                        source: 'public',
                                        biz_id: biz.id,
                                        branch_id: id,
                                        session_id: getSessionId(),
                                    });
                                }}
                                formatBranchName={formatBranchName}
                                t={t}
                            />
                        )}

                        {/* Шаг 2: день */}
                        {step === 2 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    {t('booking.step2.title', 'Шаг 2. Выберите день')}
                                </h2>
                                <div className="space-y-3">
                                    <DatePickerPopover
                                        value={dayStr}
                                        onChange={(val) => {
                                            if (val) {
                                                setDay(dateAtTz(val, '00:00', businessTz));
                                            }
                                        }}
                                        min={todayStr}
                                        max={maxStr}
                                    />
                                    {dayStr && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                            {t('booking.step2.selectedDate', 'Выбранная дата:')} {dayLabel}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Шаг 3: мастер */}
                        {step === 3 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    {t('booking.step3.title', 'Шаг 3. Выберите мастера')}
                                </h2>
                                <StaffSelector
                                    staff={staffFiltered}
                                    selectedStaffId={staffId}
                                    onSelect={(id) => {
                                        setStaffId(id);
                                        trackFunnelEvent({
                                            event_type: 'staff_select',
                                            source: 'public',
                                            biz_id: biz.id,
                                            branch_id: branchId || null,
                                            staff_id: id === 'any' ? null : id,
                                            session_id: getSessionId(),
                                        });
                                    }}
                                    dayStr={dayStr}
                                />
                            </section>
                        )}

                        {/* Шаг 4: услуга */}
                        {step === 4 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    {t('booking.step4.title', 'Шаг 4. Выберите услугу')}
                                </h2>
                                <ServiceSelector
                                    services={servicesFiltered}
                                    selectedServiceId={serviceId}
                                    onSelect={(id) => {
                                        logDebug('Booking', 'Service clicked', {
                                            serviceId: id,
                                            currentServiceId: serviceId,
                                        });
                                        setServiceId(id);
                                        trackFunnelEvent({
                                            event_type: 'service_select',
                                            source: 'public',
                                            biz_id: biz.id,
                                            branch_id: branchId || null,
                                            service_id: id,
                                            staff_id: staffId === 'any' ? null : staffId || null,
                                            session_id: getSessionId(),
                                        });
                                    }}
                                    staffId={staffId}
                                />
                                {serviceCurrent && (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {t('booking.duration.label', 'Продолжительность:')} {serviceCurrent.duration_min} {t('booking.duration.min', 'мин')}.
                                        {serviceCurrent.price_from && (
                                            <>
                                                {' '}
                                                {t('booking.summary.estimatedPrice', 'Ориентировочная стоимость:')}{' '}
                                                {serviceCurrent.price_from}
                                                {serviceCurrent.price_to &&
                                                serviceCurrent.price_to !== serviceCurrent.price_from
                                                    ? `–${serviceCurrent.price_to}`
                                                    : ''}{' '}
                                                {t('booking.currency', 'сом')}.
                                            </>
                                        )}
                                    </p>
                                )}
                            </section>
                        )}

                        {/* Шаг 5: время */}
                        {step === 5 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    {t('booking.step5.title', 'Шаг 5. Выберите время')}
                                </h2>
                                <SlotPicker
                                    slots={slots}
                                    selectedSlot={null}
                                    onSelect={(slotTime, slotStaffId) => {
                                        // Отслеживаем выбор слота
                                        trackFunnelEvent({
                                            event_type: 'slot_select',
                                            source: 'public',
                                            biz_id: biz.id,
                                            branch_id: branchId || null,
                                            service_id: serviceId || null,
                                            staff_id: slotStaffId || staffId === 'any' ? null : staffId || null,
                                            slot_start_at: slotTime.toISOString(),
                                            session_id: getSessionId(),
                                        });
                                        createBooking(slotTime, slotStaffId);
                                    }}
                                    loading={slotsLoading}
                                    error={slotsError}
                                    dayStr={dayStr}
                                    dayLabel={dayLabel}
                                    staffId={staffId}
                                    staff={staff}
                                    serviceId={serviceId}
                                    servicesFiltered={servicesFiltered}
                                    serviceStaff={serviceStaff}
                                    isAuthed={isAuthed}
                                    clientBookingsCount={clientBookingsCount}
                                    clientBookingsLoading={clientBookingsLoading}
                                    bookingLoading={bookingLoading}
                                />
                            </section>
                        )}

                        {/* Навигация по шагам */}
                        <div className="flex justify-between pt-1 text-xs">
                            <button
                                type="button"
                                disabled={!canGoPrev}
                                onClick={goPrev}
                                className={`inline-flex items-center gap-1 rounded-lg border px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm sm:text-xs font-medium transition min-h-[44px] sm:min-h-[32px] touch-manipulation ${
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
                                onClick={goNext}
                                className={`inline-flex items-center gap-1 rounded-lg border px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm sm:text-xs font-medium transition min-h-[44px] sm:min-h-[32px] touch-manipulation ${
                                    canGoNext
                                        ? 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 dark:border-indigo-400'
                                        : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed'
                                }`}
                            >
                                {step === totalSteps
                                    ? t('booking.nav.selectTime', 'Выбрать время')
                                    : t('booking.nav.next', 'Далее →')}
                            </button>
                        </div>
                    </div>

                    {/* Корзина / итог */}
                    <BookingSummary
                        branchName={branch ? formatBranchName(branch.name) : null}
                        dayLabel={dayLabel}
                        staffCurrent={staffCurrent}
                        serviceCurrent={serviceCurrent}
                        branchId={branchId}
                        branchPromotions={branchPromotions}
                        isAuthed={isAuthed}
                    />
                </div>
            </div>
            
            <AuthChoiceModal
                isOpen={authChoiceModalOpen}
                onClose={() => {
                    setAuthChoiceModalOpen(false);
                    setSelectedSlotTime(null);
                    setSelectedSlotStaffId(null);
                }}
                onAuth={() => {
                    redirectToAuth();
                }}
                onGuestBooking={() => {
                    if (selectedSlotTime) {
                        guestBooking.openModal(selectedSlotTime, selectedSlotStaffId || undefined);
                    }
                }}
                t={t}
            />
            
            <GuestBookingModal
                isOpen={guestBooking.modalOpen}
                loading={guestBooking.loading}
                form={guestBooking.form}
                onClose={guestBooking.closeModal}
                onFormChange={guestBooking.setForm}
                onSubmit={guestBooking.createGuestBooking}
                t={t}
            />
        </main>
    );
}
