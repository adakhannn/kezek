// apps/web/src/app/api/staff/shift/items/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getBizContextForManagers, getStaffContext } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST - сохранить список клиентов для открытой смены
export async function POST(req: Request) {
    // Применяем rate limiting для обычной операции
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        async () => {
            try {
                const body = await req.json().catch(() => ({}));
                const items = Array.isArray(body.items) ? body.items : [];
                const targetStaffId = body.staffId as string | undefined;

        // Валидация
        for (const it of items) {
            const serviceAmt = Number((it as { serviceAmount?: number }).serviceAmount ?? 0);
            const consumablesAmt = Number((it as { consumablesAmount?: number }).consumablesAmount ?? 0);
            if (serviceAmt < 0 || consumablesAmt < 0) {
                return NextResponse.json(
                    { ok: false, error: 'Суммы не могут быть отрицательными' },
                    { status: 400 }
                );
            }
        }

        let supabase;
        let staffId: string;
        let isOwnerMode = false;
        let useServiceClient = false;

        // Если передан staffId, проверяем права владельца/менеджера
        if (targetStaffId) {
            const { supabase: managerSupabase, bizId } = await getBizContextForManagers();
            supabase = managerSupabase;
            useServiceClient = true; // Используем service client для операций записи
            
            // Проверяем права владельца/админа/менеджера
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
            }

            const { data: roles } = await supabase
                .from('user_roles')
                .select('roles!inner(key)')
                .eq('user_id', user.id)
                .eq('biz_id', bizId);

            const hasPermission = (roles ?? []).some(r => {
                if (!r || typeof r !== 'object' || !('roles' in r)) return false;
                const roleObj = (r as { roles?: { key?: unknown } | null }).roles;
                if (!roleObj || typeof roleObj !== 'object' || !('key' in roleObj)) return false;
                const key = roleObj.key;
                return typeof key === 'string' && ['owner', 'admin', 'manager'].includes(key);
            });

            // Также проверяем через owner_id
            const { data: owned } = await supabase
                .from('businesses')
                .select('id')
                .eq('owner_id', user.id)
                .eq('id', bizId)
                .maybeSingle();

            if (!hasPermission && !owned) {
                return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
            }

            // Проверяем, что сотрудник принадлежит бизнесу
            const { data: staff } = await supabase
                .from('staff')
                .select('id, biz_id')
                .eq('id', targetStaffId)
                .maybeSingle();

            if (!staff || String(staff.biz_id) !== String(bizId)) {
                return NextResponse.json({ ok: false, error: 'STAFF_NOT_IN_THIS_BUSINESS' }, { status: 403 });
            }

            staffId = targetStaffId;
            isOwnerMode = true;
        } else {
            // Обычный режим - сотрудник редактирует свою смену
            const context = await getStaffContext();
            supabase = context.supabase;
            staffId = context.staffId;
        }

        // Находим открытую смену за сегодня
        const now = new Date();
        const ymd = formatInTimeZone(now, TZ, 'yyyy-MM-dd');

        // Получаем настройки сотрудника для расчета процентов
        const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('percent_master, percent_salon')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError) {
            logError('StaffShiftItems', 'Error loading staff for percent', staffError);
        }

        const percentMaster = Number(staffData?.percent_master ?? 60);
        const percentSalon = Number(staffData?.percent_salon ?? 40);

        const { data: existing, error: findError } = await supabase
            .from('staff_shifts')
            .select('id')
            .eq('staff_id', staffId)
            .eq('status', 'open')
            // Ищем открытую смену строго по дате смены в TZ, без сравнения с временем,
            // чтобы избежать ошибок на границах дня и различий типов (date vs timestamp)
            .eq('shift_date', ymd)
            .maybeSingle();

        if (findError) {
            logError('StaffShiftItems', 'Error finding open shift', findError);
            return NextResponse.json(
                { ok: false, error: 'Не удалось найти открытую смену' },
                { status: 500 }
            );
        }

        if (!existing) {
            return NextResponse.json(
                { ok: false, error: 'Нет открытой смены. Сначала откройте смену.' },
                { status: 400 }
            );
        }

        const shiftId = existing.id;

        // Для операций записи в режиме владельца используем service client
        const writeClient = useServiceClient ? getServiceClient() : supabase;

        // Получаем существующие записи для определения, какие нужно обновить, а какие удалить
        const { data: existingItemsData } = await writeClient
            .from('staff_shift_items')
            .select('id')
            .eq('shift_id', shiftId);
        
        const existingItemIds = new Set<string>();
        if (existingItemsData) {
            for (const item of existingItemsData) {
                if (item.id) {
                    existingItemIds.add(item.id);
                }
            }
        }

        // Собираем booking_id из всех items (даже если суммы еще не заполнены)
        // для обновления статуса записей на "выполнено" (paid)
        const allBookingIds = items
            .map((it: { bookingId?: string | null; booking_id?: string | null }) => it.bookingId ?? it.booking_id ?? null)
            .filter((id: string | null): id is string => !!id);

        // Обновляем статус записей на "выполнено" (paid), если они были добавлены в смену
        // Делаем это сразу при добавлении записи в список, даже если суммы еще не заполнены
        // Примечание: статус "paid" означает "выполнено/пришел", а не "оплачено"
        // Используем функцию с автоматическим применением акций,
        // но не трогаем уже финальные статусы (paid / no_show) и будущие записи
        const admin = getServiceClient();

        if (allBookingIds.length > 0) {
            try {
                const nowTs = new Date();

                // Загружаем текущие статусы и время начала для всех бронирований
                const { data: bookingsForUpdate, error: bookingsError } = await admin
                    .from('bookings')
                    .select('id, status, start_at')
                    .in('id', allBookingIds);

                if (bookingsError) {
                    logError('StaffShiftItems', 'Error loading bookings for status update', bookingsError);
                } else if (bookingsForUpdate && bookingsForUpdate.length > 0) {
                    const bookingsMap = new Map<string, { id: string; status: string; start_at: string | null }>();
                    for (const b of bookingsForUpdate) {
                        bookingsMap.set(String(b.id), {
                            id: String(b.id),
                            status: String(b.status),
                            start_at: b.start_at ?? null,
                        });
                    }

                    for (const bookingId of allBookingIds) {
                        const booking = bookingsMap.get(bookingId);
                        if (!booking) continue;

                        // Пропускаем уже финальные статусы
                        if (booking.status === 'paid' || booking.status === 'no_show') {
                            continue;
                        }

                        // Не отмечаем как paid записи из будущего
                        if (booking.start_at) {
                            const startAt = new Date(booking.start_at);
                            if (startAt > nowTs) {
                                continue;
                            }
                        }

                        try {
                            // Пытаемся использовать функцию с применением акций
                            const { error: rpcError } = await admin.rpc('update_booking_status_with_promotion', {
                                p_booking_id: booking.id,
                                p_new_status: 'paid',
                            });

                            // Если функция не найдена, используем стандартную
                            if (rpcError && (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist') || rpcError.message?.includes('schema cache'))) {
                                const { error: fallbackError } = await admin.rpc('update_booking_status_no_check', {
                                    p_booking_id: booking.id,
                                    p_new_status: 'paid',
                                });
                                if (fallbackError && !fallbackError.message?.includes('function') && !fallbackError.message?.includes('does not exist')) {
                                    // Если RPC не работает, используем прямой update
                                    const { error: updateError } = await admin
                                        .from('bookings')
                                        .update({ status: 'paid' })
                                        .eq('id', booking.id);
                                    if (updateError) {
                                        logError('StaffShiftItems', `Error updating booking ${booking.id} status`, updateError);
                                    }
                                }
                            } else if (rpcError && !rpcError.message?.includes('function') && !rpcError.message?.includes('does not exist')) {
                                logError('StaffShiftItems', `Error applying promotion to booking ${booking.id}`, rpcError);
                                // Продолжаем выполнение, даже если акция не применилась
                            }
                        } catch (e) {
                            logError('StaffShiftItems', `Error updating booking ${booking.id} status`, e);
                        }
                    }
                }
            } catch (e) {
                logError('StaffShiftItems', 'Unexpected error while updating bookings to paid', e);
            }
        }

        // Вставляем новые позиции (фильтруем только для сохранения в БД)
        if (items.length > 0) {
            // Получаем информацию о примененных акциях для booking_id
            const bookingIdsWithPromotion = items
                .map((it: { bookingId?: string | null; booking_id?: string | null }) => it.bookingId ?? it.booking_id ?? null)
                .filter((id: string | null): id is string => !!id);
            
            const promotionMap = new Map<string, number>(); // booking_id -> final_amount
            
            if (bookingIdsWithPromotion.length > 0) {
                const { data: bookingsWithPromotion } = await supabase
                    .from('bookings')
                    .select('id, promotion_applied')
                    .in('id', bookingIdsWithPromotion);
                
                if (bookingsWithPromotion) {
                    for (const booking of bookingsWithPromotion) {
                        if (booking.promotion_applied && typeof booking.promotion_applied === 'object' && 'final_amount' in booking.promotion_applied) {
                            const finalAmount = Number(booking.promotion_applied.final_amount);
                            if (!isNaN(finalAmount) && finalAmount >= 0) {
                                promotionMap.set(booking.id, finalAmount);
                            }
                        }
                    }
                }
            }
            
            // Разделяем на существующие (с id) и новые (без id) записи
            const existingItems = items.filter((it: { id?: string }) => !!it.id);
            const newItems = items.filter((it: { id?: string }) => !it.id);
            
            // Для существующих записей делаем UPDATE, сохраняя их created_at
            if (existingItems.length > 0) {
                for (const it of existingItems) {
                    const bookingId = (it as { bookingId?: string | null; booking_id?: string | null }).bookingId ?? (it as { bookingId?: string | null; booking_id?: string | null }).booking_id ?? null;
                    const serviceAmount = bookingId && promotionMap.has(bookingId)
                        ? promotionMap.get(bookingId)!
                        : Number((it as { serviceAmount?: number; amount?: number }).serviceAmount ?? (it as { serviceAmount?: number; amount?: number }).amount ?? 0) || 0;
                    
                    const { error: updateError } = await writeClient
                        .from('staff_shift_items')
                        .update({
                            client_name: ((it as { clientName?: string; client_name?: string }).clientName ?? (it as { clientName?: string; client_name?: string }).client_name ?? '').trim() || null,
                            service_name: ((it as { serviceName?: string; service_name?: string }).serviceName ?? (it as { serviceName?: string; service_name?: string }).service_name ?? '').trim() || null,
                            service_amount: serviceAmount,
                            consumables_amount: Number((it as { consumablesAmount?: number; consumables_amount?: number }).consumablesAmount ?? (it as { consumablesAmount?: number; consumables_amount?: number }).consumables_amount ?? 0) || 0,
                            booking_id: bookingId,
                            // created_at НЕ обновляем, чтобы сохранить оригинальное время
                        })
                        .eq('id', it.id);
                    
                    if (updateError) {
                        logError('StaffShiftItems', `Error updating item ${it.id}`, updateError);
                    }
                }
            }
            
            // Для новых записей делаем INSERT с разным created_at
            const cleanItems = newItems
                .map((it: {
                    clientName?: string;
                    client_name?: string;
                    serviceName?: string;
                    service_name?: string;
                    serviceAmount?: number;
                    amount?: number;
                    consumablesAmount?: number;
                    consumables_amount?: number;
                    bookingId?: string | null;
                    booking_id?: string | null;
                }, index: number) => {
                    const bookingId = it.bookingId ?? it.booking_id ?? null;
                    // Если есть примененная акция для этого booking_id, используем её сумму
                    // Иначе используем сумму, указанную сотрудником
                    const serviceAmount = bookingId && promotionMap.has(bookingId)
                        ? promotionMap.get(bookingId)!
                        : Number(it.serviceAmount ?? it.amount ?? 0) || 0;
                    
                    // Для новых записей устанавливаем текущее время с небольшой задержкой для каждого элемента
                    // чтобы время было разным даже при массовом добавлении
                    const createdAt = new Date(Date.now() + index * 100).toISOString(); // 100мс задержка для каждого элемента
                    
                    return {
                        shift_id: shiftId,
                        client_name: (it.clientName ?? it.client_name ?? '').trim() || null,
                        service_name: (it.serviceName ?? it.service_name ?? '').trim() || null,
                        service_amount: serviceAmount,
                        consumables_amount: Number(it.consumablesAmount ?? it.consumables_amount ?? 0) || 0,
                        booking_id: bookingId,
                        created_at: createdAt,
                    };
                })
                .filter((it: { shift_id: string; client_name: string | null; service_amount: number; consumables_amount: number; booking_id: string | null }) => 
                    // Сохраняем в БД если есть сумма ИЛИ booking_id ИЛИ client_name (чтобы сохранить добавленных клиентов даже без сумм)
                    it.service_amount > 0 || it.consumables_amount > 0 || it.booking_id !== null || (it.client_name !== null && it.client_name !== '')
                );

            if (cleanItems.length > 0) {
                const { error: insertError } = await writeClient
                    .from('staff_shift_items')
                    .insert(cleanItems);

                if (insertError) {
                    logError('StaffShiftItems', 'Error inserting items', insertError);
                    return NextResponse.json(
                        { ok: false, error: 'Не удалось сохранить позиции' },
                        { status: 500 }
                    );
                }
            }
            
            // Удаляем записи, которых нет в новом списке
            const newItemIds = new Set<string>();
            for (const it of items) {
                if ((it as { id?: string }).id) {
                    newItemIds.add((it as { id?: string }).id!);
                }
            }
            
            const itemsToDelete: string[] = [];
            for (const existingId of existingItemIds) {
                if (!newItemIds.has(existingId)) {
                    itemsToDelete.push(existingId);
                }
            }
            
            if (itemsToDelete.length > 0) {
                const { error: deleteError } = await writeClient
                    .from('staff_shift_items')
                    .delete()
                    .in('id', itemsToDelete);
                
                if (deleteError) {
                    logError('StaffShiftItems', 'Error deleting removed items', deleteError);
                    // Не возвращаем ошибку, так как основные данные уже сохранены
                }
            }
        }

        // Пересчитываем суммы для открытой смены на основе позиций
        // Это нужно, чтобы владелец мог видеть актуальные данные до закрытия смены
        const { data: savedItems } = await supabase
            .from('staff_shift_items')
            .select('service_amount, consumables_amount')
            .eq('shift_id', shiftId);

        let totalAmount = 0;
        let finalConsumablesAmount = 0;

        if (savedItems && savedItems.length > 0) {
            totalAmount = savedItems.reduce((sum, item) => sum + Number(item.service_amount ?? 0), 0);
            finalConsumablesAmount = savedItems.reduce((sum, item) => sum + Number(item.consumables_amount ?? 0), 0);
        }

        // Нормализуем проценты
        const safePercentMaster = Number.isFinite(percentMaster) ? percentMaster : 60;
        const safePercentSalon = Number.isFinite(percentSalon) ? percentSalon : 40;
        const percentSum = safePercentMaster + safePercentSalon || 100;

        const normalizedMaster = (safePercentMaster / percentSum) * 100;
        const normalizedSalon = (safePercentSalon / percentSum) * 100;

        // Доля мастера = процент от общей суммы услуг
        const masterShare = Math.round((totalAmount * normalizedMaster) / 100);
        // Доля салона = процент от общей суммы услуг + 100% расходников
        const salonShareFromAmount = Math.round((totalAmount * normalizedSalon) / 100);
        const salonShare = salonShareFromAmount + finalConsumablesAmount; // расходники 100% идут салону

        // Обновляем суммы в открытой смене
        const { error: updateShiftError } = await writeClient
            .from('staff_shifts')
            .update({
                total_amount: totalAmount,
                consumables_amount: finalConsumablesAmount,
                percent_master: normalizedMaster,
                percent_salon: normalizedSalon,
                master_share: masterShare,
                salon_share: salonShare,
            })
            .eq('id', shiftId);

        if (updateShiftError) {
            logError('StaffShiftItems', 'Error updating shift totals', updateShiftError);
            // Не возвращаем ошибку, так как позиции уже сохранены
        }

                return NextResponse.json({ ok: true });
            } catch (e) {
                logError('StaffShiftItems', 'Error saving shift items', e);
                return NextResponse.json(
                    { ok: false, error: 'Ошибка при сохранении данных' },
                    { status: 500 }
                );
            }
        }
    );
}

