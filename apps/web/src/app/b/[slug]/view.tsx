// apps/web/src/app/[slug]/view.tsx
'use client';

import { addDays, format } from 'date-fns';
import { enGB } from 'date-fns/locale/en-GB';
import { ru } from 'date-fns/locale/ru';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';


import { BookingEmptyState } from './BookingEmptyState';
import { useServicesFilter } from './hooks/useServicesFilter';
import { useSlotsLoader } from './hooks/useSlotsLoader';
import { useTemporaryTransfers } from './hooks/useTemporaryTransfers';

import {useLanguage} from '@/app/_components/i18n/LanguageProvider';
import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import { supabase } from '@/lib/supabaseClient';
import { todayTz, dateAtTz, toLabel, TZ } from '@/lib/time';
import { transliterate } from '@/lib/transliterate';
import { validateEmail, validateName, validatePhone } from '@/lib/validation';

const isDev = process.env.NODE_ENV !== 'production';
const debugLog = (...args: unknown[]) => {
    if (isDev) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
};
const debugWarn = (...args: unknown[]) => {
    if (isDev) {
         
        console.warn(...args);
    }
};
type Biz = { id: string; slug: string; name: string; address: string; phones: string[]; rating_score: number | null };
type Branch = { id: string; name: string; address?: string | null; rating_score: number | null };
type Service = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from?: number | null;
    price_to?: number | null;
    branch_id: string;
};
type Staff = { id: string; full_name: string; branch_id: string; avatar_url?: string | null; rating_score: number | null };

type Promotion = {
    id: string;
    branch_id: string;
    promotion_type: string;
    title_ru: string | null;
    params: Record<string, unknown>;
    branches?: { name: string };
};

type Data = {
    biz: Biz;
    branches: Branch[];
    services: Service[];
    staff: Staff[];
    promotions?: Promotion[];
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

type BookingStep = 1 | 2 | 3 | 4 | 5;

function useBookingSteps(params: {
    branchId: string;
    dayStr: string;
    staffId: string;
    serviceId: string;
    servicesFiltered: Service[];
    t: (key: string, fallback?: string) => string;
}) {
    const { branchId, dayStr, staffId, serviceId, servicesFiltered, t } = params;

    const [step, setStep] = useState<BookingStep>(1);
    const totalSteps: BookingStep = 5;

    const stepsMeta = useMemo(
        () => [
            { id: 1 as BookingStep, label: t('booking.step.branch', 'Филиал') },
            { id: 2 as BookingStep, label: t('booking.step.day', 'День') },
            { id: 3 as BookingStep, label: t('booking.step.master', 'Мастер') },
            { id: 4 as BookingStep, label: t('booking.step.service', 'Услуга') },
            { id: 5 as BookingStep, label: t('booking.step.time', 'Время') },
        ],
        [t],
    );

    const canGoNext = useMemo(() => {
        if (step >= totalSteps) return false;

        // Шаг 1 -> 2: должен быть выбран филиал
        if (step === 1) return !!branchId;

        // Шаг 2 -> 3: должна быть выбрана дата
        if (step === 2) return !!dayStr;

        // Шаг 3 -> 4: должен быть выбран мастер
        if (step === 3) return !!staffId;

        // Шаг 4 -> 5: должна быть выбрана услуга И мастер должен делать эту услугу
        if (step === 4) {
            if (!serviceId || !staffId) return false;

            const isServiceValid = servicesFiltered.some((s) => s.id === serviceId);
            if (!isServiceValid) {
                debugLog('[Booking] canGoNext: service not in servicesFiltered', {
                    serviceId,
                    servicesFiltered: servicesFiltered.map((s) => s.id),
                    servicesFilteredNames: servicesFiltered.map((s) => s.name_ru),
                });
                return false;
            }

            debugLog('[Booking] canGoNext: service is valid (in servicesFiltered)', { serviceId });
            return true;
        }

        return true;
    }, [step, totalSteps, branchId, dayStr, staffId, serviceId, servicesFiltered]);

    const canGoPrev = step > 1;

    const goPrev = () => {
        if (!canGoPrev) return;
        setStep((prev) => (Math.max(1, prev - 1) as BookingStep));
    };

    const goNext = () => {
        if (!canGoNext) return;
        setStep((prev) => {
            const next = (prev + 1) as BookingStep;
            return (next > totalSteps ? totalSteps : next) as BookingStep;
        });
    };

    return { step, stepsMeta, canGoNext, canGoPrev, goNext, goPrev, totalSteps };
}

function fmtErr(e: unknown, t?: (key: string, fallback?: string) => string): string {
    if (e && typeof e === 'object') {
        const any = e as { message?: string; details?: string; hint?: string; code?: string };
        const rawMessage = any.message || '';

        // Пользовательский текст для частых бизнес-ошибок
        if (rawMessage.includes('is not assigned to branch')) {
            return t?.('booking.error.masterNotAssigned', 'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.') || 'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.';
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


export default function BookingForm({ data }: { data: Data }) {
    const { biz, branches, services, staff, promotions = [] } = data;
    const {t, locale} = useLanguage();
    
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
    
    // Модальное окно для гостевой брони
    const [guestBookingModalOpen, setGuestBookingModalOpen] = useState(false);
    const [guestBookingSlotTime, setGuestBookingSlotTime] = useState<Date | null>(null);
    const [guestBookingForm, setGuestBookingForm] = useState({
        client_name: '',
        client_phone: '',
        client_email: '',
    });
    const [guestBookingLoading, setGuestBookingLoading] = useState(false);
    
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
    
    // Акции филиала
    const [branchPromotions, setBranchPromotions] = useState<Array<{
        id: string;
        promotion_type: string;
        title_ru: string;
        params: Record<string, unknown>;
    }>>([]);
    const [promotionsLoading, setPromotionsLoading] = useState(false);


    // при смене филиала — сбрасываем выборы мастеров и услуг (если не восстановили состояние из localStorage)
    useEffect(() => {
        if (restoredFromStorage) return;
        // Сбрасываем выборы при смене филиала
        setStaffId('');
        setServiceId('');
    }, [branchId, restoredFromStorage]);
    
    // Загружаем активные акции филиала
    useEffect(() => {
        let ignore = false;
        if (!branchId) {
            setBranchPromotions([]);
            return;
        }
        
        setPromotionsLoading(true);
        (async () => {
            try {
                const { data, error } = await supabase
                    .from('branch_promotions')
                    .select('id, promotion_type, title_ru, params')
                    .eq('branch_id', branchId)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });
                
                if (!ignore) {
                    if (error) {
                        console.error('[Promotions] Error loading promotions:', error);
                        setBranchPromotions([]);
                    } else {
                        setBranchPromotions(data || []);
                    }
                }
            } catch (e) {
                if (!ignore) {
                    console.error('[Promotions] Unexpected error:', e);
                    setBranchPromotions([]);
                }
            } finally {
                if (!ignore) setPromotionsLoading(false);
            }
        })();
        
        return () => {
            ignore = true;
        };
    }, [branchId]);

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

    /* ---------- дата и слоты через RPC get_free_slots_service_day_v2 ---------- */
    const [day, setDay] = useState<Date>(todayTz());
    const dayStr = formatInTimeZone(day, TZ, 'yyyy-MM-dd');
    const todayStr = formatInTimeZone(todayTz(), TZ, 'yyyy-MM-dd');
    const maxStr = formatInTimeZone(addDays(todayTz(), 60), TZ, 'yyyy-MM-dd');

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
            if (!staffId) debugLog('[Booking] Staff cleared, clearing service');
            if (!dayStr) debugLog('[Booking] Day cleared, clearing service');
            setServiceId('');
            return;
        }
        // Если выбранная услуга не подходит под нового мастера или дату — сбрасываем выбор
        if (serviceId) {
            const isServiceValid = servicesFiltered.some((s) => s.id === serviceId);
            debugLog('[Booking] Checking service validity after staff/day change:', { 
                serviceId, 
                staffId, 
                dayStr,
                isServiceValid, 
                servicesFilteredCount: servicesFiltered.length, 
                servicesFiltered: servicesFiltered.map(s => ({ id: s.id, name: s.name_ru })) 
            });
            if (!isServiceValid) {
                debugWarn('[Booking] Service is not valid for current staff/day, clearing serviceId');
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
    const [clientBookingsCount, setClientBookingsCount] = useState<number | null>(null);
    const [clientBookingsLoading, setClientBookingsLoading] = useState(false);

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

                const { data: existingBookings, error: bookingsError } = await supabase
                    .from('bookings')
                    .select('start_at, end_at, status')
                    .eq('staff_id', staffId)
                    .eq('branch_id', targetBranchId)
                    .in('status', ['hold', 'confirmed', 'paid'])
                    .gte('start_at', searchStart.toISOString())
                    .lte('end_at', searchEnd.toISOString());

                if (ignore) return;

                if (bookingsError) {
                    debugWarn('[Booking] Error loading bookings for filtering:', bookingsError);
                    setSlots(slotsFromHook);
                    return;
                }

                if (existingBookings && existingBookings.length > 0) {
                    const filtered = slotsFromHook.filter((slot) => {
                        const slotStart = new Date(slot.start_at);
                        const slotEnd = new Date(slot.end_at);

                        const overlaps = existingBookings.some((booking) => {
                            const bookingStart = new Date(booking.start_at);
                            const bookingEnd = new Date(booking.end_at);
                            return slotStart < bookingEnd && slotEnd > bookingStart;
                        });

                        return !overlaps;
                    });
                    setSlots(filtered);
                } else {
                    setSlots(slotsFromHook);
                }
            } catch (e) {
                if (!ignore) {
                    debugWarn('[Booking] Error filtering slots by bookings:', e);
                    setSlots(slotsFromHook);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, [slotsFromHook, staffId, branchId, dayStr, temporaryTransfers, staff]);

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

    /* ---------- создание бронирования ---------- */
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
            // шаг восстанавливаем через useBookingSteps чуть ниже (через payload в localStorage)

            window.localStorage.removeItem(key);
        } catch (e) {
            console.error('restore booking state failed', e);
        } finally {
            setRestoredFromStorage(true);
        }
    }, [biz.id, restoredFromStorage]); // Убрали branches, services, staff из зависимостей, чтобы избежать бесконечных ререндеров
    const [loading, setLoading] = useState(false);

    const service = useMemo(
        () => {
            // Ищем услугу сначала в отфильтрованных услугах (для временно переведенного мастера)
            // Если не найдена, ищем во всех услугах филиала
            // Если не найдена, ищем во всех услугах
            const found = servicesFiltered.find((s) => s.id === serviceId) 
                ?? servicesByBranch.find((s) => s.id === serviceId)
                ?? services.find((s) => s.id === serviceId);
            debugLog('[Booking] Finding service:', { 
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

    async function createBooking(slotTime: Date) {
        if (!service) return alert(t('booking.selectService', 'Выберите услугу'));
        if (!staffId) return alert(t('booking.selectMaster', 'Выберите мастера'));
        if (!branchId) return alert(t('booking.selectBranch', 'Выберите филиал'));

        // Если не авторизован, показываем модальное окно для гостевой брони
        if (!isAuthed) {
            setGuestBookingSlotTime(slotTime);
            setGuestBookingModalOpen(true);
            return;
        }

        setLoading(true);
        try {
            const startISO = formatInTimeZone(slotTime, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
            
            // Создаем бронирование со статусом hold, затем сразу подтверждаем
            const { data: holdData, error: holdError } = await supabase.rpc('hold_slot', {
                p_biz_id: biz.id,
                p_branch_id: branchId,
                p_service_id: service.id,
                p_staff_id: staffId,
                p_start: startISO,
            });

            if (holdError) {
                console.error('[hold_slot] error:', holdError);
                alert(fmtErr(holdError, t));
                return;
            }

            const bookingId = String(holdData);
            
            // Сразу подтверждаем бронирование
            const { error: confirmError } = await supabase.rpc('confirm_booking', { p_booking_id: bookingId });
            if (confirmError) {
                console.error('[confirm_booking] error:', confirmError);
                alert(fmtErr(confirmError, t));
                return;
            }

            // Отправляем уведомление о подтверждении
            await fetch('/api/notify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ type: 'confirm', booking_id: bookingId }),
            }).catch(() => {});

            // Редирект на страницу бронирования
            location.href = `/booking/${bookingId}`;
        } catch (e) {
            console.error('[createBooking] catch:', e);
            alert(fmtErr(e, t));
        } finally {
            setLoading(false);
        }
    }

    async function createGuestBooking() {
        if (!service || !staffId || !branchId || !guestBookingSlotTime) {
            return;
        }

        // Валидация формы
        const name = guestBookingForm.client_name.trim();
        const phone = guestBookingForm.client_phone.trim();
        const email = guestBookingForm.client_email.trim();

        // Валидация имени
        const nameValidation = validateName(name, true);
        if (!nameValidation.valid) {
            alert(nameValidation.error || t('booking.guest.nameRequired', 'Введите ваше имя'));
            return;
        }

        // Валидация телефона
        const phoneValidation = validatePhone(phone, true);
        if (!phoneValidation.valid) {
            alert(phoneValidation.error || t('booking.guest.phoneRequired', 'Введите ваш телефон'));
            return;
        }

        // Валидация email (если заполнен)
        if (email) {
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                alert(emailValidation.error || t('booking.guest.emailInvalid', 'Неверный формат email'));
                return;
            }
        }

        setGuestBookingLoading(true);
        try {
            const startISO = formatInTimeZone(guestBookingSlotTime, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
            
            const response = await fetch('/api/quick-book-guest', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    biz_id: biz.id,
                    service_id: service.id,
                    staff_id: staffId,
                    start_at: startISO,
                    client_name: name,
                    client_phone: phone,
                    client_email: guestBookingForm.client_email.trim() || null,
                }),
            });

            const result = await response.json();

            if (!result.ok) {
                throw new Error(result.message || 'Ошибка при создании бронирования');
            }

            // Закрываем модальное окно
            setGuestBookingModalOpen(false);
            setGuestBookingForm({ client_name: '', client_phone: '', client_email: '' });
            setGuestBookingSlotTime(null);

            // Редирект на страницу бронирования
            if (result.booking_id) {
                location.href = `/booking/${result.booking_id}`;
            }
        } catch (e) {
            console.error('[createGuestBooking] catch:', e);
            alert(fmtErr(e, t));
        } finally {
            setGuestBookingLoading(false);
        }
    }

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
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100">
                            {biz.name}
                        </h1>
                        {biz.rating_score !== null && biz.rating_score !== undefined && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                                    {biz.rating_score.toFixed(1)}
                                </span>
                            </div>
                        )}
                    </div>
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
                
                {/* Активные акции филиала */}
                {branchId && branchPromotions.length > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                        <h3 className="mb-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                            {t('booking.promotions.title', '🎁 Активные акции в этом филиале:')}
                        </h3>
                        <div className="space-y-2">
                            {branchPromotions.map((promotion) => {
                                const params = promotion.params || {};
                                let description = promotion.title_ru || '';
                                
                                if (promotion.promotion_type === 'free_after_n_visits' && params.visit_count) {
                                    description = t('booking.promotions.freeAfterN', 'Каждая {n}-я услуга бесплатно').replace('{n}', String(params.visit_count));
                                } else if ((promotion.promotion_type === 'birthday_discount' || promotion.promotion_type === 'first_visit_discount' || promotion.promotion_type === 'referral_discount_50') && params.discount_percent) {
                                    description = t('booking.promotions.discountPercent', 'Скидка {percent}%').replace('{percent}', String(params.discount_percent));
                                }
                                
                                return (
                                    <div key={promotion.id} className="flex items-start gap-2 rounded-lg bg-white dark:bg-gray-900 px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                                        <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-xs text-emerald-800 dark:text-emerald-200">{description}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Степпер по шагам */}
                <div id="booking" className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    {stepsMeta.map((s, index) => {
                        const isActive = s.id === step;
                        const isCompleted = s.id < step;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                    // Переход к шагу возможен только если все предыдущие шаги валидны
                                    if (s.id < step) {
                                        goPrev();
                                        return;
                                    }
                                    if (s.id > step && !canGoNext) return;
                                    // Прямой переход на произвольный шаг пока ограничиваем UX-кнопками "Далее/Назад"
                                }}
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
                                    {t('booking.step1.title', 'Шаг 1. Выберите филиал')}
                                </h2>
                                {branches.length === 0 ? (
                                    <BookingEmptyState
                                        type="empty"
                                        message={t('booking.empty.noBranches', 'У этого бизнеса нет активных филиалов. Пожалуйста, вернитесь позже.')}
                                    />
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {branches.map((b) => {
                                            const active = b.id === branchId;
                                            return (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    onClick={() => setBranchId(b.id)}
                                                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                                                        active
                                                            ? 'border-indigo-600 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60'
                                                            : 'border-gray-300 bg-white hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className={`text-sm font-medium ${
                                                            active
                                                                ? 'text-indigo-700 dark:text-indigo-100'
                                                                : 'text-gray-800 dark:text-gray-100'
                                                        }`}>
                                                            {formatBranchName(b.name)}
                                                        </span>
                                                        {b.rating_score !== null && b.rating_score !== undefined && (
                                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded border border-amber-200 dark:border-amber-800">
                                                                <svg className="w-3 h-3 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                                </svg>
                                                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                                    {b.rating_score.toFixed(1)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {b.address && (
                                                        <span className={`mt-1 text-xs ${
                                                            active
                                                                ? 'text-indigo-600 dark:text-indigo-200'
                                                                : 'text-gray-600 dark:text-gray-400'
                                                        }`}>
                                                            {b.address}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
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
                                                setDay(dateAtTz(val, '00:00'));
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
                                {!dayStr ? (
                                    <BookingEmptyState
                                        type="info"
                                        message={t('booking.empty.selectDayFirst', 'Сначала выберите день.')}
                                    />
                                ) : staffFiltered.length === 0 ? (
                                    <BookingEmptyState
                                        type="empty"
                                        message={t('booking.empty.noStaff', 'На выбранную дату в этом филиале нет доступных мастеров. Выберите другой день.')}
                                    />
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {staffFiltered.map((m) => {
                                            const active = m.id === staffId;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setStaffId(m.id)}
                                                    className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium transition ${
                                                        active
                                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-100'
                                                            : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                                                    }`}
                                                >
                                                    {m.avatar_url ? (
                                                        <img
                                                            src={m.avatar_url}
                                                            alt={formatStaffName(m.full_name)}
                                                            className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                                                            onError={(e) => {
                                                                // Скрываем изображение, если оно не загрузилось
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-base font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
                                                            {formatStaffName(m.full_name).charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 flex items-center justify-between">
                                                        <span className="text-left">{formatStaffName(m.full_name)}</span>
                                                        {m.rating_score !== null && m.rating_score !== undefined && (
                                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded border border-amber-200 dark:border-amber-800 ml-2">
                                                                <svg className="w-3 h-3 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                                </svg>
                                                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                                    {m.rating_score.toFixed(1)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Шаг 4: услуга */}
                        {step === 4 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    {t('booking.step4.title', 'Шаг 4. Выберите услугу')}
                                </h2>
                                {!staffId ? (
                                    <BookingEmptyState
                                        type="info"
                                        message={t('booking.empty.selectMasterFirst', 'Сначала выберите мастера.')}
                                    />
                                ) : servicesFiltered.length === 0 ? (
                                    <BookingEmptyState
                                        type="empty"
                                        message={t('booking.empty.noServices', 'У выбранного мастера пока нет назначенных услуг. Выберите другого мастера.')}
                                    />
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
                                                        onClick={() => {
                                                            debugLog('[Booking] Service clicked:', { serviceId: s.id, name: s.name_ru, currentServiceId: serviceId });
                                                            setServiceId(s.id);
                                                        }}
                                                        className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                                                            active
                                                                ? 'border-indigo-600 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60'
                                                                : 'border-gray-200 bg-white hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                                                                {formatServiceName(s)}
                                                            </div>
                                                            <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                                                {s.duration_min} {t('booking.duration.min', 'мин')}
                                                            </div>
                                                        </div>
                                                        {(typeof s.price_from === 'number' ||
                                                            typeof s.price_to === 'number') && (
                                                            <div className="whitespace-nowrap text-right text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                {s.price_from}
                                                                {hasRange && s.price_to ? `–${s.price_to}` : ''}{' '}
                                                                {t('booking.currency', 'сом')}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
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
                                    </>
                                )}
                            </section>
                        )}

                        {/* Шаг 5: время */}
                        {step === 5 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    {t('booking.step5.title', 'Шаг 5. Выберите время')}
                                </h2>
                                {dayStr && (
                                    <div className="mb-3 text-xs text-gray-600 dark:text-gray-400">
                                        {t('booking.step5.selectedDate', 'Выбранная дата:')} {dayLabel}
                                    </div>
                                )}

                                {/* Проверка: есть ли у выбранного сотрудника услуги для выбранной услуги */}
                                {/* Используем servicesFiltered, который уже учитывает временные переводы и похожие услуги */}
                                {/* Показываем ошибку только если:
                                    1. Услуга не валидна (не в servicesFiltered)
                                    2. serviceStaff загружен (не null) - проверка завершена
                                    3. Слоты не загружаются (не loading)
                                    4. Слотов нет (slots.length === 0) - если слоты есть, значит услуга валидна */}
                                {serviceId && staffId && !slotsLoading && slots.length === 0 && (() => {
                                    // Проверяем, есть ли услуга в servicesFiltered (это значит, что мастер может её выполнять)
                                    // servicesFiltered уже учитывает временные переводы и связи service_staff (включая похожие услуги)
                                    const isServiceValid = servicesFiltered.some((s) => s.id === serviceId);
                                    
                                    // Показываем ошибку только если услуга не валидна И serviceStaff загружен (не null)
                                    // Если serviceStaff еще загружается (null), не показываем ошибку, так как проверка еще не завершена
                                    // Также не показываем ошибку, если есть ошибка загрузки слотов (slotsError) - там будет своё сообщение
                                    if (serviceStaff !== null && !isServiceValid && !slotsError) {
                                        return (
                                            <div className="mb-3">
                                                <BookingEmptyState
                                                    type="warning"
                                                    message={t('booking.step5.masterNoService', 'Выбранный мастер не выполняет эту услугу')}
                                                    hint={t('booking.step5.masterNoServiceHint', 'Пожалуйста, вернитесь к шагу 4 и выберите другого мастера или выберите другую услугу.')}
                                                />
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Уведомление, если у клиента уже есть запись в этом бизнесе на выбранный день */}
                                {isAuthed && !clientBookingsLoading && clientBookingsCount && clientBookingsCount > 0 && (
                                    <div className="mb-3">
                                        <BookingEmptyState
                                            type="warning"
                                            message={
                                                clientBookingsCount === 1
                                                    ? t('booking.existingBookings.warning.one', 'У вас уже есть одна активная запись в этом заведении на выбранный день.')
                                                    : t('booking.existingBookings.warning.many', `У вас уже есть ${clientBookingsCount} активных записей в этом заведении на выбранный день.`)
                                            }
                                            hint={t('booking.existingBookings.hint', 'Вы всё равно можете оформить ещё одну запись, если это необходимо.')}
                                        />
                                    </div>
                                )}

                                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {t('booking.freeSlots', 'Свободные слоты')}
                                </h3>
                                {slotsLoading && (
                                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                        {t('booking.loadingSlots', 'Загружаем свободные слоты...')}
                                    </div>
                                )}
                                {!slotsLoading && slotsError && (
                                    <BookingEmptyState
                                        type="error"
                                        message={slotsError}
                                    />
                                )}
                                {!slotsLoading && !slotsError && slots.length === 0 && (
                                    <BookingEmptyState
                                        type="empty"
                                        message={t('booking.empty.noSlots', 'На выбранный день нет свободных слотов. Выберите другой день или мастера.')}
                                    />
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
                                                    onClick={() => createBooking(d)}
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
                                onClick={goPrev}
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
                                onClick={goNext}
                                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
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
                    <aside className="space-y-3 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {t('booking.summary.title', 'Ваша запись')}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('booking.summary.hint', 'Шаги слева → выберите мастера, услугу, день и время. Здесь вы увидите итог перед подтверждением.')}
                        </p>

                        <div className="mt-2 space-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">{t('booking.summary.branch', 'Филиал:')}</span>
                                <span className="font-medium">{branch ? formatBranchName(branch.name) : t('booking.summary.notSelected', 'Не выбран')}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">{t('booking.summary.service', 'Услуга:')}</span>
                                <span className="text-right font-medium">
                                    {serviceCurrent ? formatServiceName(serviceCurrent) : t('booking.summary.notSelectedFem', 'Не выбрана')}
                                </span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">{t('booking.summary.master', 'Мастер:')}</span>
                                <div className="flex items-center gap-2 text-right">
                                    {staffCurrent?.avatar_url ? (
                                        <img
                                            src={staffCurrent.avatar_url}
                                            alt={formatStaffName(staffCurrent.full_name)}
                                            className="h-8 w-8 rounded-full object-cover ml-auto"
                                            onError={(e) => {
                                                // Скрываем изображение, если оно не загрузилось
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    ) : staffCurrent ? (
                                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400 ml-auto">
                                            {formatStaffName(staffCurrent.full_name).charAt(0).toUpperCase()}
                                        </div>
                                    ) : null}
                                    <span className="font-medium">
                                        {staffCurrent ? formatStaffName(staffCurrent.full_name) : t('booking.summary.notSelected', 'Не выбран')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">{t('booking.summary.day', 'День:')}</span>
                                <span className="text-right font-medium">{dayLabel}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">{t('booking.summary.time', 'Время:')}</span>
                                <span className="text-right font-medium">
                                    {t('booking.summary.selectSlot', 'Выберите слот')}
                                </span>
                            </div>
                            {serviceCurrent?.price_from && (
                                <div className="mt-1 flex justify-between gap-2 border-t border-dashed border-gray-300 pt-1 dark:border-gray-700">
                                    <span className="text-gray-500">{t('booking.summary.estimatedPrice', 'Ориентировочная стоимость:')}</span>
                                    <span className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                        {serviceCurrent.price_from}
                                        {serviceCurrent.price_to &&
                                        serviceCurrent.price_to !== serviceCurrent.price_from
                                            ? `–${serviceCurrent.price_to}`
                                            : ''}{' '}
                                        {t('booking.currency', 'сом')}
                                    </span>
                                </div>
                            )}
                            
                            {/* Информация об акциях */}
                            {branchId && branchPromotions.length > 0 && (
                                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
                                    <div className="flex items-start gap-2">
                                        <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100 mb-1">
                                                {t('booking.summary.promotionWillApply', 'При оплате будет применена акция:')}
                                            </p>
                                            <ul className="space-y-1">
                                                {branchPromotions.map((promotion) => {
                                                    const params = promotion.params || {};
                                                    let description = promotion.title_ru || '';
                                                    
                                                    if (promotion.promotion_type === 'free_after_n_visits' && params.visit_count) {
                                                        description = t('booking.promotions.freeAfterN', 'Каждая {n}-я услуга бесплатно').replace('{n}', String(params.visit_count));
                                                    } else if ((promotion.promotion_type === 'birthday_discount' || promotion.promotion_type === 'first_visit_discount' || promotion.promotion_type === 'referral_discount_50') && params.discount_percent) {
                                                        description = t('booking.promotions.discountPercent', 'Скидка {percent}%').replace('{percent}', String(params.discount_percent));
                                                    }
                                                    
                                                    return (
                                                        <li key={promotion.id} className="text-xs text-emerald-800 dark:text-emerald-200">
                                                            • {description}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            {!isAuthed ? (
                                <span>{t('booking.needAuth', 'Для бронирования необходимо войти или зарегистрироваться. Нажмите кнопку «Войти» вверху страницы.')}</span>
                            ) : (
                                <span>{t('booking.summary.selectSlotFirst', 'Выберите свободный слот для бронирования.')}</span>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
            
            {/* Модальное окно для гостевой брони */}
            {guestBookingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !guestBookingLoading && setGuestBookingModalOpen(false)}>
                    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {t('booking.guest.title', 'Быстрая бронь без регистрации')}
                            </h3>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {t('booking.guest.subtitle', 'Заполните ваши данные для бронирования')}
                            </p>
                        </div>
                        
                        <div className="px-4 py-4 space-y-3">
                            {/* Имя */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('booking.guest.name', 'Ваше имя')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={guestBookingForm.client_name}
                                    onChange={(e) => setGuestBookingForm({ ...guestBookingForm, client_name: e.target.value })}
                                    placeholder={t('booking.guest.namePlaceholder', 'Введите ваше имя')}
                                    disabled={guestBookingLoading}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500"
                                    autoFocus
                                />
                            </div>
                            
                            {/* Телефон */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('booking.guest.phone', 'Телефон')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={guestBookingForm.client_phone}
                                    onChange={(e) => setGuestBookingForm({ ...guestBookingForm, client_phone: e.target.value })}
                                    placeholder={t('booking.guest.phonePlaceholder', '+996555123456')}
                                    disabled={guestBookingLoading}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500"
                                />
                            </div>
                            
                            {/* Email (опционально) */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('booking.guest.email', 'Email')} <span className="text-xs text-gray-400">({t('booking.guest.optional', 'необязательно')})</span>
                                </label>
                                <input
                                    type="email"
                                    value={guestBookingForm.client_email}
                                    onChange={(e) => setGuestBookingForm({ ...guestBookingForm, client_email: e.target.value })}
                                    placeholder={t('booking.guest.emailPlaceholder', 'you@example.com')}
                                    disabled={guestBookingLoading}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500"
                                />
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                            <button
                                type="button"
                                onClick={() => {
                                    if (!guestBookingLoading) {
                                        setGuestBookingModalOpen(false);
                                        setGuestBookingForm({ client_name: '', client_phone: '', client_email: '' });
                                        setGuestBookingSlotTime(null);
                                    }
                                }}
                                disabled={guestBookingLoading}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                {t('booking.guest.cancel', 'Отмена')}
                            </button>
                            <button
                                type="button"
                                onClick={createGuestBooking}
                                disabled={guestBookingLoading}
                                className="rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-400"
                            >
                                {guestBookingLoading 
                                    ? t('booking.guest.booking', 'Бронируем...') 
                                    : t('booking.guest.book', 'Забронировать')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
