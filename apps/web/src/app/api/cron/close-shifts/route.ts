// apps/web/src/app/api/cron/close-shifts/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getServiceClient } from '@/lib/supabaseService';
import { TZ, dateAtTz } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Проверка секретного ключа для безопасности
const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(req: Request) {
    try {
        // Проверяем секретный ключ для безопасности
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getServiceClient();

        // Получаем вчерашнюю дату в локальной TZ
        const now = new Date();
        // Вычитаем один день
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const ymd = formatInTimeZone(yesterday, TZ, 'yyyy-MM-dd');

        console.log(`[Close Shifts Cron] Closing shifts for date: ${ymd}`);

        // Находим все открытые смены за вчерашний день
        const { data: openShifts, error: findError } = await supabase
            .from('staff_shifts')
            .select('id, staff_id, shift_date, opened_at, branch_id, biz_id')
            .eq('status', 'open')
            .eq('shift_date', ymd);

        if (findError) {
            console.error('[Close Shifts Cron] Error finding open shifts:', findError);
            return NextResponse.json(
                { ok: false, error: findError.message },
                { status: 500 }
            );
        }

        if (!openShifts || openShifts.length === 0) {
            console.log('[Close Shifts Cron] No open shifts to close');
            return NextResponse.json({ 
                ok: true, 
                message: 'No open shifts to close',
                closed: 0 
            });
        }

        console.log(`[Close Shifts Cron] Found ${openShifts.length} open shifts to close`);

        let closedCount = 0;
        const errors: string[] = [];

        // Закрываем каждую смену
        for (const shift of openShifts) {
            try {
                // Получаем настройки сотрудника
                const { data: staffData, error: staffError } = await supabase
                    .from('staff')
                    .select('percent_master, percent_salon, hourly_rate')
                    .eq('id', shift.staff_id)
                    .maybeSingle();

                if (staffError || !staffData) {
                    console.error(`[Close Shifts Cron] Error loading staff ${shift.staff_id}:`, staffError);
                    errors.push(`Staff ${shift.staff_id}: ${staffError?.message || 'Not found'}`);
                    continue;
                }

                const percentMaster = Number(staffData.percent_master ?? 60);
                const percentSalon = Number(staffData.percent_salon ?? 40);
                const hourlyRate = staffData.hourly_rate ? Number(staffData.hourly_rate) : null;

                // Получаем позиции смены, если они есть
                const { data: shiftItems, error: itemsError } = await supabase
                    .from('staff_shift_items')
                    .select('service_amount, consumables_amount')
                    .eq('shift_id', shift.id);

                if (itemsError) {
                    console.error(`[Close Shifts Cron] Error loading shift items for ${shift.id}:`, itemsError);
                }

                // Рассчитываем суммы
                let totalAmount = 0;
                let finalConsumablesAmount = 0;

                if (shiftItems && shiftItems.length > 0) {
                    // Используем суммы из позиций
                    totalAmount = shiftItems.reduce(
                        (sum, item) => sum + Number(item.service_amount ?? 0),
                        0
                    );
                    finalConsumablesAmount = shiftItems.reduce(
                        (sum, item) => sum + Number(item.consumables_amount ?? 0),
                        0
                    );
                } else {
                    // Если позиций нет, пытаемся посчитать из бронирований
                    const dayStart = `${ymd}T00:00:00`;
                    const dayEnd = `${ymd}T23:59:59`;
                    
                    const { data: bookings, error: bookingsError } = await supabase
                        .from('bookings')
                        .select('id, service_id, services:services!bookings_service_id_fkey (price_from, price_to)')
                        .eq('staff_id', shift.staff_id)
                        .gte('start_at', dayStart)
                        .lte('start_at', dayEnd)
                        .neq('status', 'cancelled');

                    if (!bookingsError && bookings) {
                        // Используем price_from как оценку (или среднее, если есть price_to)
                        for (const booking of bookings) {
                            const service = Array.isArray(booking.services) 
                                ? booking.services[0] 
                                : booking.services;
                            
                            if (service && typeof service === 'object') {
                                const priceFrom = Number((service as { price_from?: number | null }).price_from ?? 0);
                                const priceTo = Number((service as { price_to?: number | null }).price_to ?? 0);
                                
                                if (priceFrom > 0) {
                                    // Используем среднее значение, если есть диапазон, иначе price_from
                                    const estimatePrice = priceTo > priceFrom 
                                        ? (priceFrom + priceTo) / 2 
                                        : priceFrom;
                                    totalAmount += estimatePrice;
                                }
                            }
                        }
                    }
                    // Если бронирований нет или их суммы нулевые, закрываем с нулевыми суммами
                }

                // Нормализуем проценты
                const safePercentMaster = Number.isFinite(percentMaster) ? percentMaster : 60;
                const safePercentSalon = Number.isFinite(percentSalon) ? percentSalon : 40;
                const percentSum = safePercentMaster + safePercentSalon || 100;

                const normalizedMaster = (safePercentMaster / percentSum) * 100;
                const normalizedSalon = (safePercentSalon / percentSum) * 100;

                // Доля мастера и салона
                const masterShare = Math.round((totalAmount * normalizedMaster) / 100);
                const salonShareFromAmount = Math.round((totalAmount * normalizedSalon) / 100);
                const salonShare = salonShareFromAmount + finalConsumablesAmount;

                // Расчет оплаты за выход (если указана ставка за час)
                let hoursWorked: number | null = null;
                let guaranteedAmount = 0;
                let topupAmount = 0;

                if (hourlyRate && shift.opened_at) {
                    const openedAt = new Date(shift.opened_at);
                    // ВАЖНО: для cron job используем полночь следующего дня как время закрытия
                    // (так как cron закрывает смены автоматически в полночь)
                    const todayInTz = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
                    const todayDate = new Date(todayInTz + 'T12:00:00');
                    todayDate.setDate(todayDate.getDate() + 1);
                    const nextDayYmd = formatInTimeZone(todayDate, TZ, 'yyyy-MM-dd');
                    const midnightNextDay = dateAtTz(nextDayYmd, '00:00');
                    
                    const diffMs = midnightNextDay.getTime() - openedAt.getTime();
                    hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

                    guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;

                    if (guaranteedAmount > masterShare) {
                        topupAmount = Math.round((guaranteedAmount - masterShare) * 100) / 100;
                    }
                }

                // Финальные значения для сохранения
                // Если есть гарантированная сумма и она больше базовой доли, используем её
                const finalMasterShare = (guaranteedAmount > masterShare) ? guaranteedAmount : masterShare;
                // Скорректированная доля бизнеса (вычитаем доплату за выход, если она была)
                const finalSalonShare = Math.max(0, salonShare - topupAmount);

                // Время закрытия - полночь следующего дня в правильном часовом поясе TZ
                const todayInTz = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
                const todayDate = new Date(todayInTz + 'T12:00:00');
                todayDate.setDate(todayDate.getDate() + 1);
                const nextDayYmd = formatInTimeZone(todayDate, TZ, 'yyyy-MM-dd');
                const midnightNextDay = dateAtTz(nextDayYmd, '00:00');
                const closedAt = midnightNextDay.toISOString();

                // Обновляем смену
                const { error: updateError } = await supabase
                    .from('staff_shifts')
                    .update({
                        total_amount: totalAmount,
                        consumables_amount: finalConsumablesAmount,
                        percent_master: normalizedMaster,
                        percent_salon: normalizedSalon,
                        master_share: finalMasterShare,
                        salon_share: finalSalonShare,
                        hours_worked: hoursWorked,
                        hourly_rate: hourlyRate,
                        guaranteed_amount: guaranteedAmount,
                        topup_amount: topupAmount,
                        status: 'closed',
                        closed_at: closedAt,
                    })
                    .eq('id', shift.id);

                if (updateError) {
                    console.error(`[Close Shifts Cron] Error closing shift ${shift.id}:`, updateError);
                    errors.push(`Shift ${shift.id}: ${updateError.message}`);
                    continue;
                }

                closedCount++;
                console.log(`[Close Shifts Cron] Successfully closed shift ${shift.id}`);

                // После закрытия смены:
                // 1) Переводим связанные записи в статус "paid" с применением акций
                // 2) Остальные ещё не обработанные записи помечаем как "no_show"
                try {
                    const dayStart = `${ymd}T00:00:00`;
                    const dayEnd = `${ymd}T23:59:59`;

                    // Получаем все записи сотрудника за этот день
                    const { data: todayBookings, error: bookingsError } = await supabase
                        .from('bookings')
                        .select('id, status')
                        .eq('staff_id', shift.staff_id)
                        .gte('start_at', dayStart)
                        .lte('start_at', dayEnd)
                        .neq('status', 'cancelled');

                    if (!bookingsError && todayBookings) {
                        // Получаем список booking_id из позиций смены
                        const { data: shiftItems } = await supabase
                            .from('staff_shift_items')
                            .select('booking_id')
                            .eq('shift_id', shift.id)
                            .not('booking_id', 'is', null);

                        const addedBookingIds = new Set(
                            (shiftItems ?? [])
                                .map((it: { booking_id: string | null }) => it.booking_id)
                                .filter((id: string | null): id is string => !!id)
                        );

                        // 1) Обновляем статус "paid" с применением акций для всех записей, которые есть в смене
                        const bookingsById = new Map<string, { id: string; status: string }>();
                        for (const b of todayBookings) {
                            bookingsById.set(String(b.id), { id: String(b.id), status: String(b.status) });
                        }

                        for (const bookingId of addedBookingIds) {
                            const booking = bookingsById.get(bookingId);
                            if (!booking) continue;

                            // Пропускаем уже финальные статусы
                            if (booking.status === 'paid' || booking.status === 'no_show') {
                                continue;
                            }

                            try {
                                const { error: rpcError } = await supabase.rpc('update_booking_status_with_promotion', {
                                    p_booking_id: booking.id,
                                    p_new_status: 'paid',
                                });

                                if (!rpcError) {
                                    continue;
                                }

                                // Fallback: если функции нет — возвращаемся к старому поведению
                                if (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist') || rpcError.message?.includes('schema cache')) {
                                    const { error: fallbackRpcError } = await supabase.rpc('update_booking_status_no_check', {
                                        p_booking_id: booking.id,
                                        p_new_status: 'paid',
                                    });

                                    if (fallbackRpcError && !fallbackRpcError.message?.includes('function') && !fallbackRpcError.message?.includes('does not exist')) {
                                        await supabase
                                            .from('bookings')
                                            .update({ status: 'paid' })
                                            .eq('id', booking.id);
                                    }
                                } else {
                                    console.error(`[Close Shifts Cron] Error updating booking ${booking.id} status to paid via promotions RPC:`, rpcError);
                                }
                            } catch (e) {
                                console.error(`[Close Shifts Cron] Error updating booking ${booking.id} status to paid:`, e);
                            }
                        }

                        // 2) Находим записи, которые не были добавлены в смену и ещё не имеют финального статуса
                        const notAddedBookings = todayBookings.filter(
                            (b) =>
                                !addedBookingIds.has(b.id) &&
                                b.status !== 'no_show' &&
                                b.status !== 'paid'
                        );

                        // Устанавливаем статус "не пришел" для записей, которые не были добавлены
                        for (const booking of notAddedBookings) {
                            try {
                                const { error: rpcError } = await supabase.rpc('update_booking_status_no_check', {
                                    p_booking_id: booking.id,
                                    p_new_status: 'no_show',
                                });
                                if (rpcError && !rpcError.message?.includes('function') && !rpcError.message?.includes('does not exist')) {
                                    await supabase
                                        .from('bookings')
                                        .update({ status: 'no_show' })
                                        .eq('id', booking.id);
                                }
                            } catch (e) {
                                console.error(`[Close Shifts Cron] Error updating booking ${booking.id} status to no_show:`, e);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`[Close Shifts Cron] Error processing bookings for shift ${shift.id}:`, e);
                }
            } catch (error) {
                console.error(`[Close Shifts Cron] Unexpected error closing shift ${shift.id}:`, error);
                errors.push(`Shift ${shift.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        return NextResponse.json({
            ok: true,
            message: `Closed ${closedCount} of ${openShifts.length} shifts`,
            closed: closedCount,
            total: openShifts.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('[Close Shifts Cron] Unexpected error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

