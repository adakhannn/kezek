// apps/web/src/app/api/staff/shift/close/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { logApiMetric, getIpAddress, determineErrorType } from '@/lib/apiMetrics';
import { getStaffContext } from '@/lib/authBiz';
import { calculateShiftFinancials } from '@/lib/financeDomain';
import { logError, logDebug } from '@/lib/log';
import { sendShiftCloseNotification } from '@/lib/notifications/shiftNotifications';
import { measurePerformance } from '@/lib/performance';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ, dateAtTz } from '@/lib/time';
import { validateRequest } from '@/lib/validation/apiValidation';
import { closeShiftSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StaffShiftRow = {
    id: string;
    staff_id: string;
    biz_id: string;
    shift_date: string;
    status: 'open' | 'closed';
    opened_at: string | null;
    closed_at: string | null;
    total_amount: number | null;
    consumables_amount: number | null;
    percent_master: number | null;
    percent_salon: number | null;
    master_share: number | null;
    salon_share: number | null;
    hours_worked: number | null;
    hourly_rate: number | null;
    guaranteed_amount: number | null;
    topup_amount: number | null;
};

type CloseStaffShiftRpcResult = {
    ok: boolean;
    error?: string | null;
    shift?: StaffShiftRow | null;
};

export async function POST(req: Request) {
    const startTime = Date.now();
    const endpoint = '/api/staff/shift/close';
    let statusCode = 500;
    let staffId: string | undefined;
    let bizId: string | undefined;
    let userId: string | undefined;
    let errorMessage: string | undefined;
    
    // Применяем rate limiting для критичной операции
    return withRateLimit(
        req,
        RateLimitConfigs.critical,
        async () => {
            try {
                const context = await getStaffContext();
                const { supabase, staffId: ctxStaffId, bizId: ctxBizId } = context;
                staffId = ctxStaffId;
                bizId = ctxBizId;
                
                // Получаем user_id из сессии для логирования
                const { data: { user } } = await supabase.auth.getUser();
                userId = user?.id;

                // Валидация входных данных с помощью Zod схемы
                const validationResult = await validateRequest(req, closeShiftSchema);
                if (!validationResult.success) {
                    // Форматируем ошибки валидации для более понятного сообщения
                    const errorResponse = await validationResult.response.json();
                    const errorMessage = errorResponse.errors 
                        ? `Ошибка валидации: ${errorResponse.errors.map((e: { path: string; message: string }) => `${e.path}: ${e.message}`).join(', ')}`
                        : errorResponse.message || 'Ошибка валидации данных';
                    return NextResponse.json(
                        { ok: false, error: errorMessage },
                        { status: 400 }
                    );
                }
                
                const { items = [], totalAmount: totalAmountRaw = 0, consumablesAmount = 0 } = validationResult.data;

        // Получаем проценты, ставку за час и имя из настроек сотрудника
        const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('percent_master, percent_salon, hourly_rate, full_name, user_id')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError) {
            logError('StaffShiftClose', 'Error loading staff for percent', staffError);
            return NextResponse.json(
                { 
                    ok: false, 
                    error: 'Не удалось загрузить настройки сотрудника. Проверьте подключение к интернету и попробуйте снова.' 
                },
                { status: 500 }
            );
        }

        const percentMaster = Number(staffData?.percent_master ?? 60);
        const percentSalon = Number(staffData?.percent_salon ?? 40);

        const now = new Date();
        const ymd = formatInTimeZone(now, TZ, 'yyyy-MM-dd');

        const { data: existing, error: loadError } = await supabase
            .from('staff_shifts')
            .select('*')
            .eq('staff_id', staffId)
            .eq('shift_date', ymd)
            .maybeSingle<StaffShiftRow>();

        if (loadError) {
            logError('StaffShiftClose', 'Error loading shift for close', loadError);
            return NextResponse.json(
                { 
                    ok: false, 
                    error: loadError.message || 'Не удалось загрузить данные смены. Проверьте подключение к интернету и попробуйте снова.' 
                },
                { status: 500 }
            );
        }

        if (!existing) {
            return NextResponse.json(
                { 
                    ok: false, 
                    error: 'Смена на сегодня ещё не открыта. Сначала откройте смену, затем добавьте клиентов и закройте её.' 
                },
                { status: 400 }
            );
        }

        if (existing.status === 'closed') {
            return NextResponse.json(
                { 
                    ok: false, 
                    error: 'Смена уже закрыта. Обновите страницу для просмотра результатов.' 
                },
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

        // Расчет оплаты за выход (если указана ставка за час)
        const hourlyRate = staffData?.hourly_rate ? Number(staffData.hourly_rate) : null;
        let hoursWorked: number | null = null;

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
        }

        // Используем единый доменный слой для расчета всех финансовых показателей
        const financials = calculateShiftFinancials({
            totalAmount,
            totalConsumables: finalConsumablesAmount,
            percentMaster,
            percentSalon,
            hoursWorked,
            hourlyRate,
        });

        // Данные для обновления смены (используются в RPC вызове)

        // Используем безопасную SQL функцию с защитой от race conditions
        // Функция проверяет статус в WHERE и использует SELECT FOR UPDATE
        // Мониторинг производительности закрытия смены
        const { data: rpcResult, error: rpcError } = await measurePerformance(
            'shift_close',
            async () => {
                return await supabase.rpc('close_staff_shift_safe', {
                    p_shift_id: existing.id,
                    p_total_amount: financials.totalAmount,
                    p_consumables_amount: financials.totalConsumables,
                    p_percent_master: financials.normalizedPercentMaster,
                    p_percent_salon: financials.normalizedPercentSalon,
                    p_master_share: financials.finalMasterShare,
                    p_salon_share: financials.finalSalonShare,
                    p_hours_worked: hoursWorked,
                    p_hourly_rate: hourlyRate,
                    p_guaranteed_amount: financials.guaranteedAmount,
                    p_topup_amount: financials.topupAmount,
                    p_closed_at: closedAt,
                });
            },
            { shiftId: existing.id, staffId, totalAmount, itemsCount: items.length }
        );

        if (rpcError) {
            logError('StaffShiftClose', 'Error calling close_staff_shift_safe RPC', rpcError);
            
            // Улучшенные сообщения об ошибках
            let errorMessage = 'Не удалось закрыть смену';
            if (rpcError.code === 'P0001' || rpcError.message?.includes('already closed')) {
                errorMessage = 'Смена уже закрыта';
            } else if (rpcError.code === '23505') {
                errorMessage = 'Конфликт данных. Смена могла быть закрыта другим процессом. Обновите страницу.';
            } else if (rpcError.message) {
                errorMessage = rpcError.message;
            }
            
            return NextResponse.json(
                { ok: false, error: errorMessage },
                { status: 500 }
            );
        }

        // Проверяем результат RPC
        const typedResult: CloseStaffShiftRpcResult | null = rpcResult as CloseStaffShiftRpcResult | null;
        if (!typedResult || !typedResult.ok) {
            const errorMsg = typedResult?.error || 'Не удалось закрыть смену';
            logError('StaffShiftClose', 'RPC returned error', { error: errorMsg, result: rpcResult });
            return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
        }

        const shift = typedResult.shift;
        if (!shift) {
            logError('StaffShiftClose', 'RPC returned ok but no shift data', rpcResult);
            return NextResponse.json({ 
                ok: false, 
                error: 'Смена закрыта, но не удалось получить обновленные данные. Обновите страницу для просмотра результатов.' 
            }, { status: 500 });
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
                .map((it) => {
                    // Типизируем item с учетом возможных null значений
                    const item = it as {
                        clientName?: string | null;
                        client_name?: string | null;
                        serviceName?: string | null;
                        service_name?: string | null;
                        serviceAmount?: number | null;
                        amount?: number | null;
                        consumablesAmount?: number | null;
                        consumables_amount?: number | null;
                        bookingId?: string | null;
                        booking_id?: string | null;
                        note?: string | null;
                    };
                    return {
                        shift_id: shiftId,
                        client_name: item.clientName ?? item.client_name ?? null,
                        service_name: item.serviceName ?? item.service_name ?? null,
                        service_amount: Number(item.serviceAmount ?? item.amount ?? 0) || 0,
                        consumables_amount: Number(item.consumablesAmount ?? item.consumables_amount ?? 0) || 0,
                        booking_id: item.bookingId ?? item.booking_id ?? null,
                        note: item.note ?? null,
                    };
                })
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

                statusCode = 200;
                const response = NextResponse.json({ ok: true, shift: updated });
                
                // Отправляем уведомления о закрытии смены (асинхронно, не блокируем ответ)
                const adminClient = getServiceClient();
                
                // Получаем email сотрудника
                let staffEmail: string | null = null;
                if (staffData?.user_id) {
                    const { data: userData } = await adminClient.auth.admin.getUserById(staffData.user_id);
                    staffEmail = userData?.user?.email || null;
                }
                
                // Получаем email владельца
                let ownerEmail: string | null = null;
                const { data: ownerData } = await adminClient
                    .from('businesses')
                    .select('owner_id')
                    .eq('id', bizId)
                    .maybeSingle();
                
                if (ownerData?.owner_id) {
                    const { data: ownerUserData } = await adminClient.auth.admin.getUserById(ownerData.owner_id);
                    ownerEmail = ownerUserData?.user?.email || null;
                }
                
                // Отправляем уведомления асинхронно (не блокируем ответ)
                if (staffEmail) {
                    sendShiftCloseNotification({
                        staffName: staffData?.full_name || 'Сотрудник',
                        staffEmail,
                        ownerEmail,
                        shiftDate: ymd,
                        totalAmount: financials.totalAmount,
                        masterShare: financials.finalMasterShare,
                        salonShare: financials.finalSalonShare,
                        itemsCount: items.length,
                        hoursWorked,
                        guaranteedAmount: financials.guaranteedAmount,
                        topupAmount: financials.topupAmount,
                    }).catch((error) => {
                        // Логируем ошибку, но не блокируем ответ
                        logError('StaffShiftClose', 'Failed to send shift close notification', error);
                    });
                }
                
                // Логируем метрику асинхронно (не блокируем ответ)
                logApiMetric({
                    endpoint,
                    method: 'POST',
                    statusCode,
                    durationMs: Date.now() - startTime,
                    userId,
                    staffId,
                    bizId,
                    ipAddress: getIpAddress(req),
                    userAgent: req.headers.get('user-agent') || undefined,
                }).catch(() => {
                    // Игнорируем ошибки логирования
                });
                
                return response;
            } catch (error) {
                logError('StaffShiftClose', 'Unexpected error', error);
                const message = error instanceof Error ? error.message : 'Unknown error';
                errorMessage = message;
                statusCode = 500;
                
                // Логируем метрику с ошибкой
                logApiMetric({
                    endpoint,
                    method: 'POST',
                    statusCode,
                    durationMs: Date.now() - startTime,
                    userId,
                    staffId,
                    bizId,
                    errorMessage,
                    errorType: determineErrorType(statusCode, errorMessage) || undefined,
                    ipAddress: getIpAddress(req),
                    userAgent: req.headers.get('user-agent') || undefined,
                }).catch(() => {
                    // Игнорируем ошибки логирования
                });
                
                return NextResponse.json({ ok: false, error: message }, { status: statusCode });
            }
        }
    );
}


