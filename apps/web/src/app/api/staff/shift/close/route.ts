// apps/web/src/app/api/staff/shift/close/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getStaffContext } from '@/lib/authBiz';
import { logError, logDebug } from '@/lib/log';
import { measurePerformance } from '@/lib/performance';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ, dateAtTz } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    // Применяем rate limiting для критичной операции
    return withRateLimit(
        req,
        RateLimitConfigs.critical,
        async () => {
            try {
                const { supabase, staffId } = await getStaffContext();

        const body = await req.json().catch(() => ({}));
        const totalAmountRaw = Number(body.totalAmount ?? 0);
        const consumablesAmount = Number(body.consumablesAmount ?? 0); // для обратной совместимости
        const items = Array.isArray(body.items) ? body.items : [];

        // Получаем проценты и ставку за час из настроек сотрудника
        const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('percent_master, percent_salon, hourly_rate')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError) {
            logError('StaffShiftClose', 'Error loading staff for percent', staffError);
            return NextResponse.json(
                { ok: false, error: 'Не удалось загрузить настройки сотрудника' },
                { status: 500 }
            );
        }

        const percentMaster = Number(staffData?.percent_master ?? 60);
        const percentSalon = Number(staffData?.percent_salon ?? 40);

        // Валидация: проверяем суммы в items, если они переданы
        if (items.length > 0) {
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
        } else if (totalAmountRaw < 0 || consumablesAmount < 0) {
            return NextResponse.json(
                { ok: false, error: 'Суммы не могут быть отрицательными' },
                { status: 400 }
            );
        }

        const now = new Date();
        const ymd = formatInTimeZone(now, TZ, 'yyyy-MM-dd');

        const { data: existing, error: loadError } = await supabase
            .from('staff_shifts')
            .select('*')
            .eq('staff_id', staffId)
            .eq('shift_date', ymd)
            .maybeSingle();

        if (loadError) {
            logError('StaffShiftClose', 'Error loading shift for close', loadError);
            return NextResponse.json(
                { ok: false, error: loadError.message },
                { status: 500 }
            );
        }

        if (!existing) {
            return NextResponse.json(
                { ok: false, error: 'Смена на сегодня ещё не открыта' },
                { status: 400 }
            );
        }

        if (existing.status === 'closed') {
            return NextResponse.json(
                { ok: false, error: 'Смена уже закрыта' },
                { status: 400 }
            );
        }

        // Если переданы позиции по клиентам, считаем итог по ним
        const totalServiceAmount = Array.isArray(items)
            ? items.reduce(
                  (sum: number, it: { serviceAmount?: number }) => sum + Number(it?.serviceAmount ?? 0),
                  0
              )
            : 0;

        const totalConsumablesFromItems = Array.isArray(items)
            ? items.reduce(
                  (sum: number, it: { consumablesAmount?: number }) => sum + Number(it?.consumablesAmount ?? 0),
                  0
              )
            : 0;

        // Итоговая сумма услуг = сумма всех serviceAmount
        // Итоговые расходники = либо из поля consumablesAmount (если не переданы items), либо сумма consumablesAmount по клиентам
        const totalAmount = items.length > 0 ? totalServiceAmount : totalAmountRaw;
        const finalConsumablesAmount = items.length > 0 ? totalConsumablesFromItems : consumablesAmount;

        // Проценты считаются от общей суммы услуг (до вычета расходников)
        // Расходники добавляются к доле салона сверху
        
        // Проценты из настроек сотрудника (уже должны быть 100% в сумме)
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

        // Расчет оплаты за выход (если указана ставка за час)
        const hourlyRate = staffData?.hourly_rate ? Number(staffData.hourly_rate) : null;
        let hoursWorked: number | null = null;
        let guaranteedAmount = 0;
        let topupAmount = 0;

        // Время закрытия - полночь следующего дня в правильном часовом поясе TZ
        // Правильно вычисляем следующую дату в часовом поясе TZ
        const todayInTz = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
        const todayDate = new Date(todayInTz + 'T12:00:00'); // Создаем дату в локальном времени для манипуляций
        todayDate.setDate(todayDate.getDate() + 1);
        const nextDayYmd = formatInTimeZone(todayDate, TZ, 'yyyy-MM-dd');
        // Создаем полночь следующего дня в часовом поясе TZ
        const midnightNextDay = dateAtTz(nextDayYmd, '00:00');
        const closedAt = midnightNextDay.toISOString();

        if (hourlyRate && existing.opened_at) {
            // Вычисляем количество отработанных часов
            // opened_at хранится в UTC в базе данных
            const openedAt = new Date(existing.opened_at);
            // Используем текущее время (now) для расчета, а не полночь следующего дня
            // Это более точно отражает реальное время работы
            const currentTime = now;
            const diffMs = currentTime.getTime() - openedAt.getTime();
            hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // округляем до 2 знаков
            
            logDebug('StaffShiftClose', 'Hours calculation', {
                ymd,
                openedAt: existing.opened_at,
                openedAtDate: openedAt.toISOString(),
                now: now.toISOString(),
                midnightNextDay: midnightNextDay.toISOString(),
                diffMs,
                hoursWorked,
            });

            // Гарантированная сумма за выход
            guaranteedAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;

            // Если гарантированная сумма больше доли сотрудника, владелец доплачивает разницу
            if (guaranteedAmount > masterShare) {
                topupAmount = Math.round((guaranteedAmount - masterShare) * 100) / 100;
            }
        }

        // Финальные значения для сохранения
        // Если есть гарантированная сумма и она больше базовой доли, используем её
        const finalMasterShare = (guaranteedAmount > masterShare) ? guaranteedAmount : masterShare;
        // Скорректированная доля бизнеса (вычитаем доплату за выход, если она была)
        const finalSalonShare = Math.max(0, salonShare - topupAmount);

        const updatePayload: {
            total_amount: number;
            consumables_amount: number;
            percent_master: number;
            percent_salon: number;
            master_share: number;
            salon_share: number;
            hours_worked: number | null;
            hourly_rate: number | null;
            guaranteed_amount: number;
            topup_amount: number;
            status: 'closed';
            closed_at: string;
        } = {
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
            status: 'closed' as const,
            closed_at: closedAt,
        };

        // Используем безопасную SQL функцию с защитой от race conditions
        // Функция проверяет статус в WHERE и использует SELECT FOR UPDATE
        // Мониторинг производительности закрытия смены
        const { data: rpcResult, error: rpcError } = await measurePerformance(
            'shift_close',
            async () => {
                return await supabase.rpc('close_staff_shift_safe', {
                    p_shift_id: existing.id,
                    p_total_amount: totalAmount,
                    p_consumables_amount: finalConsumablesAmount,
                    p_percent_master: normalizedMaster,
                    p_percent_salon: normalizedSalon,
                    p_master_share: finalMasterShare,
                    p_salon_share: finalSalonShare,
                    p_hours_worked: hoursWorked,
                    p_hourly_rate: hourlyRate,
                    p_guaranteed_amount: guaranteedAmount,
                    p_topup_amount: topupAmount,
                    p_closed_at: closedAt,
                });
            },
            { shiftId: existing.id, staffId, totalAmount, itemsCount: items.length }
        );

        if (rpcError) {
            logError('StaffShiftClose', 'Error calling close_staff_shift_safe RPC', rpcError);
            return NextResponse.json(
                { ok: false, error: rpcError.message || 'Не удалось закрыть смену' },
                { status: 500 }
            );
        }

        // Проверяем результат RPC
        if (!rpcResult || !(rpcResult as { ok?: boolean }).ok) {
            const errorMsg = (rpcResult as { error?: string })?.error || 'Не удалось закрыть смену';
            logError('StaffShiftClose', 'RPC returned error', { error: errorMsg, result: rpcResult });
            return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
        }

        const shift = (rpcResult as { shift?: unknown }).shift;
        if (!shift) {
            logError('StaffShiftClose', 'RPC returned ok but no shift data', rpcResult);
            return NextResponse.json({ ok: false, error: 'Не удалось получить данные смены' }, { status: 500 });
        }

        const updated = shift as typeof existing;

        // Перезаписываем позиции смены, если они были переданы
        // Важно: используем позиции из запроса для обновления, сохраняя booking_id даже если суммы = 0
        const shiftId = updated.id;
        const admin = getServiceClient();
        
        // Сначала получаем существующие позиции из БД (которые могли быть сохранены через автсохранение)
        const { data: existingItems } = await supabase
            .from('staff_shift_items')
            .select('booking_id')
            .eq('shift_id', shiftId)
            .not('booking_id', 'is', null);

        const existingBookingIds = new Set(
            (existingItems ?? [])
                .map((it: { booking_id: string | null }) => it.booking_id)
                .filter((id: string | null): id is string => !!id)
        );

        // Собираем все booking_id (из существующих и из переданных items)
        const allBookingIdsForStatusUpdate = new Set<string>(existingBookingIds);

        if (items.length > 0) {
            const cleanItems = items
                .map((it: {
                    clientName?: string;
                    client_name?: string;
                    serviceName?: string;
                    service_name?: string;
                    serviceAmount?: number;
                    amount?: number; // для обратной совместимости
                    consumablesAmount?: number;
                    consumables_amount?: number; // для обратной совместимости
                    bookingId?: string;
                    booking_id?: string; // для обратной совместимости
                    note?: string;
                }) => ({
                    shift_id: shiftId,
                    client_name: it.clientName ?? it.client_name ?? null,
                    service_name: it.serviceName ?? it.service_name ?? null,
                    service_amount: Number(it.serviceAmount ?? it.amount ?? 0) || 0,
                    consumables_amount: Number(it.consumablesAmount ?? it.consumables_amount ?? 0) || 0,
                    booking_id: it.bookingId ?? it.booking_id ?? null,
                    note: it.note ?? null,
                }))
                // Сохраняем позиции, если есть суммы ИЛИ booking_id (чтобы сохранить связь с записью, даже если суммы еще не заполнены)
                .filter((it: { service_amount: number; consumables_amount: number; booking_id: string | null }) => 
                    it.service_amount > 0 || it.consumables_amount > 0 || it.booking_id !== null
                );

            // Собираем booking_id из переданных items
            const newBookingIds = cleanItems
                .map((it: { booking_id: string | null }) => it.booking_id)
                .filter((id: string | null): id is string => !!id);
            
            // Добавляем новые booking_id к существующим
            for (const id of newBookingIds) {
                allBookingIdsForStatusUpdate.add(id);
            }

            // Удаляем все старые позиции (они будут пересозданы с обновленными данными)
            const { error: delError } = await supabase
                .from('staff_shift_items')
                .delete()
                .eq('shift_id', shiftId);

            if (delError) {
                logError('StaffShiftClose', 'Error deleting old shift items', delError);
            } else if (cleanItems.length > 0) {
                const { error: insError } = await supabase
                    .from('staff_shift_items')
                    .insert(cleanItems);
                if (insError) {
                    logError('StaffShiftClose', 'Error inserting shift items', insError);
                }
            }
        }
        
        // Обновляем статус записей на "выполнено" (paid) для всех booking_id (из существующих и из переданных items)
        // Примечание: статус "paid" означает "выполнено/пришел", а не "оплачено"
        // ВАЖНО: при переводе в paid используем функцию update_booking_status_with_promotion,
        // чтобы автоматически применять акции (promotions)
        if (allBookingIdsForStatusUpdate.size > 0) {
            try {
                const bookingIdsArray = Array.from(allBookingIdsForStatusUpdate);

                // Сначала получаем текущие статусы, чтобы не трогать уже обработанные брони
                const { data: bookingsForUpdate, error: bookingsForUpdateError } = await admin
                    .from('bookings')
                    .select('id, status')
                    .in('id', bookingIdsArray);

                if (bookingsForUpdateError) {
                    logError('StaffShiftClose', 'Error loading bookings for status update', bookingsForUpdateError);
                }

                const statusMap = new Map<string, string>();
                for (const b of bookingsForUpdate || []) {
                    statusMap.set(String(b.id), String(b.status));
                }

                for (const bookingId of bookingIdsArray) {
                    try {
                        const currentStatus = statusMap.get(bookingId);
                        // Если бронь уже в финальном статусе, не трогаем её
                        if (currentStatus === 'paid' || currentStatus === 'no_show') {
                            continue;
                        }

                        // Пытаемся использовать функцию с автоматическим применением акций
                        const { error: rpcError } = await admin.rpc('update_booking_status_with_promotion', {
                            p_booking_id: bookingId,
                            p_new_status: 'paid',
                        });

                        if (!rpcError) {
                            continue;
                        }

                        // Если функции нет или проблемы со схемой кэша — откатываемся на старое поведение
                        if (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist') || rpcError.message?.includes('schema cache')) {
                            const { error: fallbackRpcError } = await admin.rpc('update_booking_status_no_check', {
                                p_booking_id: bookingId,
                                p_new_status: 'paid',
                            });

                            if (fallbackRpcError && !fallbackRpcError.message?.includes('function') && !fallbackRpcError.message?.includes('does not exist')) {
                                await admin
                                    .from('bookings')
                                    .update({ status: 'paid' })
                                    .eq('id', bookingId);
                            }
                        } else {
                            // Любая другая ошибка — логируем, но не падаем целиком
                            logError('StaffShiftClose', `Error updating booking ${bookingId} status to paid via promotions RPC`, rpcError);
                        }
                    } catch (e) {
                        logError('StaffShiftClose', `Error updating booking ${bookingId} status`, e);
                    }
                }
            } catch (e) {
                logError('StaffShiftClose', 'Unexpected error while updating bookings to paid on shift close', e);
            }
        }

        // После закрытия смены: находим все записи сотрудника за этот день,
        // которые не были добавлены в список позиций смены, и устанавливаем им статус "не пришел" (no_show)
        // Используем allBookingIdsForStatusUpdate (из существующих и переданных items) для определения добавленных записей
        const todayStart = `${ymd}T00:00:00`;
        const todayEnd = `${ymd}T23:59:59`;

        // Получаем все записи сотрудника за сегодня
        const { data: todayBookings, error: bookingsError } = await admin
            .from('bookings')
            .select('id, status')
            .eq('staff_id', staffId)
            .gte('start_at', todayStart)
            .lte('start_at', todayEnd)
            .neq('status', 'cancelled');

        if (!bookingsError && todayBookings) {
            // Находим записи, которые не были добавлены в смену
            // Используем allBookingIdsForStatusUpdate (все booking_id, которые были в смене) для проверки
            // Важно: не трогаем записи, которые уже имеют статус "paid" (выполнено) или "confirmed" - они уже были обработаны
            const notAddedBookings = todayBookings.filter(
                (b) => !allBookingIdsForStatusUpdate.has(b.id) && b.status !== 'no_show' && b.status !== 'paid' && b.status !== 'confirmed'
            );

            // Устанавливаем статус "не пришел" только для записей, которые действительно не были добавлены
            // и еще не имеют финального статуса (paid, no_show, confirmed)
            for (const booking of notAddedBookings) {
                try {
                    const { error: rpcError } = await admin.rpc('update_booking_status_no_check', {
                        p_booking_id: booking.id,
                        p_new_status: 'no_show',
                    });
                    if (rpcError && !rpcError.message?.includes('function') && !rpcError.message?.includes('does not exist')) {
                        await admin
                            .from('bookings')
                            .update({ status: 'no_show' })
                            .eq('id', booking.id);
                    }
                } catch (e) {
                    logError('StaffShiftClose', `Error updating booking ${booking.id} status to no_show`, e);
                }
            }
        }

                return NextResponse.json({ ok: true, shift: updated });
            } catch (error) {
                logError('StaffShiftClose', 'Unexpected error', error);
                const message = error instanceof Error ? error.message : 'Unknown error';
                return NextResponse.json({ ok: false, error: message }, { status: 500 });
            }
        }
    );
}


