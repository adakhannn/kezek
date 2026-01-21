// apps/web/src/app/api/staff/shift/items/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getStaffContext } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST - сохранить список клиентов для открытой смены
export async function POST(req: Request) {
    try {
        const { supabase, staffId } = await getStaffContext();

        const body = await req.json().catch(() => ({}));
        const items = Array.isArray(body.items) ? body.items : [];

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
            console.error('Error loading staff for percent:', staffError);
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
            console.error('Error finding open shift:', findError);
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

        // Удаляем старые позиции
        const { error: deleteError } = await supabase
            .from('staff_shift_items')
            .delete()
            .eq('shift_id', shiftId);

        if (deleteError) {
            console.error('Error deleting old items:', deleteError);
            return NextResponse.json(
                { ok: false, error: 'Не удалось удалить старые позиции' },
                { status: 500 }
            );
        }

        // Собираем booking_id из всех items (даже если суммы еще не заполнены)
        // для обновления статуса записей на "выполнено" (paid)
        const allBookingIds = items
            .map((it: { bookingId?: string | null; booking_id?: string | null }) => it.bookingId ?? it.booking_id ?? null)
            .filter((id: string | null): id is string => !!id);

        // Обновляем статус записей на "выполнено" (paid), если они были добавлены в смену
        // Делаем это сразу при добавлении записи в список, даже если суммы еще не заполнены
        // Примечание: статус "paid" означает "выполнено/пришел", а не "оплачено"
        // Используем функцию с автоматическим применением акций
        const admin = getServiceClient();
        const promotionInfoMap = new Map<string, { final_amount?: number; discount_percent?: number }>();
        
        if (allBookingIds.length > 0) {
            for (const bookingId of allBookingIds) {
                try {
                    // Пытаемся использовать функцию с применением акций
                    const { data: promotionResult, error: rpcError } = await admin.rpc('update_booking_status_with_promotion', {
                        p_booking_id: bookingId,
                        p_new_status: 'paid',
                    });
                    
                    // Сохраняем информацию об акции, если она была применена
                    if (promotionResult && promotionResult.applied) {
                        promotionInfoMap.set(bookingId, {
                            final_amount: promotionResult.final_amount,
                            discount_percent: promotionResult.discount_percent,
                        });
                    }
                    
                    // Если функция не найдена, используем стандартную
                    if (rpcError && (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist'))) {
                        const { error: fallbackError } = await admin.rpc('update_booking_status_no_check', {
                            p_booking_id: bookingId,
                            p_new_status: 'paid',
                        });
                        if (fallbackError && !fallbackError.message?.includes('function') && !fallbackError.message?.includes('does not exist')) {
                            // Если RPC не работает, используем прямой update
                            const { error: updateError } = await admin
                                .from('bookings')
                                .update({ status: 'paid' })
                                .eq('id', bookingId);
                            if (updateError) {
                                console.error(`Error updating booking ${bookingId} status:`, updateError);
                            }
                        }
                    } else if (rpcError && !rpcError.message?.includes('function') && !rpcError.message?.includes('does not exist')) {
                        console.error(`Error applying promotion to booking ${bookingId}:`, rpcError);
                        // Продолжаем выполнение, даже если акция не применилась
                    }
                } catch (e) {
                    console.error(`Error updating booking ${bookingId} status:`, e);
                }
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
            
            const cleanItems = items
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
                }) => {
                    const bookingId = it.bookingId ?? it.booking_id ?? null;
                    // Если есть примененная акция для этого booking_id, используем её сумму
                    // Иначе используем сумму, указанную сотрудником
                    const serviceAmount = bookingId && promotionMap.has(bookingId)
                        ? promotionMap.get(bookingId)!
                        : Number(it.serviceAmount ?? it.amount ?? 0) || 0;
                    
                    return {
                        shift_id: shiftId,
                        client_name: (it.clientName ?? it.client_name ?? '').trim() || null,
                        service_name: (it.serviceName ?? it.service_name ?? '').trim() || null,
                        service_amount: serviceAmount,
                        consumables_amount: Number(it.consumablesAmount ?? it.consumables_amount ?? 0) || 0,
                        booking_id: bookingId,
                    };
                })
                .filter((it: { service_amount: number; consumables_amount: number; booking_id: string | null }) => 
                    // Сохраняем в БД только если есть сумма ИЛИ booking_id (чтобы сохранить связь с записью)
                    it.service_amount > 0 || it.consumables_amount > 0 || it.booking_id !== null
                );

            if (cleanItems.length > 0) {
                const { error: insertError } = await supabase
                    .from('staff_shift_items')
                    .insert(cleanItems);

                if (insertError) {
                    console.error('Error inserting items:', insertError);
                    return NextResponse.json(
                        { ok: false, error: 'Не удалось сохранить позиции' },
                        { status: 500 }
                    );
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
        const { error: updateShiftError } = await supabase
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
            console.error('Error updating shift totals:', updateShiftError);
            // Не возвращаем ошибку, так как позиции уже сохранены
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('Error saving shift items:', e);
        return NextResponse.json(
            { ok: false, error: 'Ошибка при сохранении данных' },
            { status: 500 }
        );
    }
}

