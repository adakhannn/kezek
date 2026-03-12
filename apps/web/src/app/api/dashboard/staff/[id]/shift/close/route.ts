/**
 * POST /api/dashboard/staff/[id]/shift/close
 * Закрытие смены сотрудника от имени менеджера/владельца.
 * Query: date=YYYY-MM-DD (опционально, по умолчанию — сегодня в TZ).
 * Body: closeShiftSchema (items, totalAmount?, consumablesAmount?).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { sendShiftCloseNotification } from '@/lib/notifications/shiftNotifications';
import { measurePerformance } from '@/lib/performance';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getRouteParamUuid } from '@/lib/routeParams';
import { closeStaffShiftUseCase } from '@/lib/staffShift/closeUseCase';
import { TZ, dateAtTz, formatDateInTz } from '@/lib/time';
import { validateRequest } from '@/lib/validation/apiValidation';
import { closeShiftSchema, dateStringSchema } from '@/lib/validation/schemas';
import { withManagerContext } from '@/lib/withManagerContext';

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

export async function POST(req: Request, context: unknown) {
    return withRateLimit(req, RateLimitConfigs.critical, async () => {
        return withErrorHandler('DashboardStaffShiftClose', async () => {
            const staffId = await getRouteParamUuid(context, 'id');

            return withManagerContext(req, 'DashboardStaffShiftClose', async ({ admin, bizId }) => {
                // Проверяем, что сотрудник принадлежит бизнесу
                const { data: staff, error: staffError } = await admin
                    .from('staff')
                    .select('id, biz_id, full_name, percent_master, percent_salon, hourly_rate, user_id')
                    .eq('id', staffId)
                    .maybeSingle();

                if (staffError) {
                    logError('DashboardStaffShiftClose', 'Error loading staff', staffError);
                    return createErrorResponse('internal', 'Не удалось загрузить данные сотрудника', undefined, 500);
                }

                if (!staff) {
                    return createErrorResponse('not_found', 'Сотрудник не найден или доступ запрещён', undefined, 404);
                }

                const normalizedBizId = bizId ? String(bizId).trim() : null;
                const normalizedStaffBizId = staff.biz_id != null ? String(staff.biz_id).trim() : null;
                if (!normalizedStaffBizId || !normalizedBizId || normalizedStaffBizId !== normalizedBizId) {
                    logError('DashboardStaffShiftClose', 'Staff business mismatch', {
                        staffId,
                        staffBizId: normalizedStaffBizId,
                        requestedBizId: normalizedBizId,
                    });
                    return createErrorResponse('forbidden', 'Сотрудник не принадлежит этому бизнесу', undefined, 403);
                }

                // Дата смены: из query или сегодня
                const { searchParams } = new URL(req.url);
                const dateParam = searchParams.get('date');
                let ymd: string;
                if (dateParam) {
                    const parsed = dateStringSchema.safeParse(dateParam);
                    if (!parsed.success) {
                        return createErrorResponse(
                            'validation',
                            'Неверный формат даты. Ожидается YYYY-MM-DD.',
                            undefined,
                            400
                        );
                    }
                    ymd = parsed.data;
                } else {
                    ymd = formatDateInTz(new Date(), TZ);
                }

                // Валидация тела запроса
                const validationResult = await validateRequest(req, closeShiftSchema);
                if (!validationResult.success) {
                    const errorResponse = await validationResult.response.json();
                    const errorMessage =
                        (errorResponse as { errors?: Array<{ path: string; message: string }> }).errors
                            ? `Ошибка валидации: ${(errorResponse as { errors: Array<{ path: string; message: string }> }).errors.map((e) => `${e.path}: ${e.message}`).join(', ')}`
                            : (errorResponse as { message?: string }).message || 'Ошибка валидации данных';
                    return createErrorResponse('validation', errorMessage, undefined, 400);
                }

                const { items = [], totalAmount: totalAmountRaw = 0, consumablesAmount = 0 } = validationResult.data;

                const now = new Date();

                const { data: existing, error: loadError } = await admin
                    .from('staff_shifts')
                    .select('*')
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .eq('shift_date', ymd)
                    .maybeSingle<StaffShiftRow>();

                if (loadError) {
                    logError('DashboardStaffShiftClose', 'Error loading shift', loadError);
                    return createErrorResponse('internal', 'Не удалось загрузить смену', undefined, 500);
                }

                if (!existing) {
                    return createErrorResponse(
                        'validation',
                        'Смена на выбранную дату не открыта. Сначала откройте смену.',
                        undefined,
                        400
                    );
                }

                if (existing.status === 'closed') {
                    return createErrorResponse(
                        'validation',
                        'Смена уже закрыта. Обновите страницу для просмотра результатов.',
                        undefined,
                        400
                    );
                }

                const todayInTz = formatDateInTz(now, TZ);
                const todayDate = new Date(todayInTz + 'T12:00:00');
                todayDate.setDate(todayDate.getDate() + 1);
                const nextDayYmd = formatDateInTz(todayDate, TZ);
                const midnightNextDay = dateAtTz(nextDayYmd, '00:00');
                const closedAt = midnightNextDay.toISOString();

                const decision = closeStaffShiftUseCase({
                    now,
                    staff: {
                        percentMaster: staff.percent_master,
                        percentSalon: staff.percent_salon,
                        hourlyRate: staff.hourly_rate,
                    },
                    shift: existing,
                    items,
                    totalAmountRaw,
                    consumablesAmountRaw: consumablesAmount,
                });

                if (decision.kind === 'no_shift') {
                    return createErrorResponse(
                        'validation',
                        'Смена на выбранную дату не открыта. Сначала откройте смену.',
                        undefined,
                        400
                    );
                }

                if (decision.kind === 'already_closed') {
                    return createErrorResponse(
                        'validation',
                        'Смена уже закрыта. Обновите страницу для просмотра результатов.',
                        undefined,
                        400
                    );
                }

                const { hoursWorked, financials } = decision;
                const hourlyRate = staff.hourly_rate ? Number(staff.hourly_rate) : null;

                const { data: rpcResult, error: rpcError } = await measurePerformance(
                    'shift_close_dashboard',
                    async () => {
                        return await admin.rpc('close_staff_shift_safe', {
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
                    { shiftId: existing.id, staffId, itemsCount: items.length }
                );

                if (rpcError) {
                    logError('DashboardStaffShiftClose', 'Error calling close_staff_shift_safe RPC', rpcError);
                    let msg = 'Не удалось закрыть смену';
                    if (rpcError.code === 'P0001' || rpcError.message?.includes('already closed')) msg = 'Смена уже закрыта';
                    else if (rpcError.code === '23505') msg = 'Конфликт данных. Обновите страницу.';
                    else if (rpcError.message) msg = rpcError.message;
                    return createErrorResponse('internal', msg, undefined, 500);
                }

                const typedResult = rpcResult as CloseStaffShiftRpcResult | null;
                if (!typedResult?.ok) {
                    const errorMsg = typedResult?.error || 'Не удалось закрыть смену';
                    logError('DashboardStaffShiftClose', 'RPC returned error', { error: errorMsg, result: rpcResult });
                    return createErrorResponse('internal', errorMsg, undefined, 500);
                }

                const shift = typedResult.shift;
                if (!shift) {
                    logError('DashboardStaffShiftClose', 'RPC returned ok but no shift data', rpcResult);
                    return createErrorResponse(
                        'internal',
                        'Смена закрыта, но не удалось получить обновлённые данные. Обновите страницу.',
                        undefined,
                        500
                    );
                }

                const updated = shift as typeof existing;
                const shiftId = updated.id;

                const { data: existingItems } = await admin
                    .from('staff_shift_items')
                    .select('booking_id')
                    .eq('shift_id', shiftId)
                    .not('booking_id', 'is', null);

                const existingBookingIds = new Set(
                    (existingItems ?? [])
                        .map((it: { booking_id: string | null }) => it.booking_id)
                        .filter((id: string | null): id is string => !!id)
                );

                const allBookingIdsForStatusUpdate = new Set<string>(existingBookingIds);

                if (items.length > 0) {
                    const cleanItems = items
                        .map((it) => {
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
                        .filter(
                            (it: { service_amount: number; consumables_amount: number; booking_id: string | null }) =>
                                it.service_amount > 0 || it.consumables_amount > 0 || it.booking_id !== null
                        );

                    for (const it of cleanItems) {
                        if (it.booking_id) allBookingIdsForStatusUpdate.add(it.booking_id);
                    }

                    const { error: delError } = await admin
                        .from('staff_shift_items')
                        .delete()
                        .eq('shift_id', shiftId);

                    if (delError) {
                        logError('DashboardStaffShiftClose', 'Error deleting old shift items', delError);
                    } else if (cleanItems.length > 0) {
                        const { error: insError } = await admin.from('staff_shift_items').insert(cleanItems);
                        if (insError) {
                            logError('DashboardStaffShiftClose', 'Error inserting shift items', insError);
                        }
                    }
                }

                if (allBookingIdsForStatusUpdate.size > 0) {
                    const bookingIdsArray = Array.from(allBookingIdsForStatusUpdate);
                    try {
                        const { data: bookingsForUpdate, error: bookingsForUpdateError } = await admin
                            .from('bookings')
                            .select('id, status')
                            .in('id', bookingIdsArray);

                        if (bookingsForUpdateError) {
                            logError('DashboardStaffShiftClose', 'Error loading bookings for status update', bookingsForUpdateError);
                        }

                        const statusMap = new Map<string, string>();
                        for (const b of bookingsForUpdate || []) {
                            statusMap.set(String(b.id), String(b.status));
                        }

                        for (const bookingId of bookingIdsArray) {
                            try {
                                const currentStatus = statusMap.get(bookingId);
                                if (currentStatus === 'paid' || currentStatus === 'no_show') continue;

                                const { error: rpcErr } = await admin.rpc('update_booking_status_with_promotion', {
                                    p_booking_id: bookingId,
                                    p_new_status: 'paid',
                                });

                                if (!rpcErr) continue;

                                if (
                                    rpcErr.message?.includes('function') ||
                                    rpcErr.message?.includes('does not exist') ||
                                    rpcErr.message?.includes('schema cache')
                                ) {
                                    const { error: fallbackRpcErr } = await admin.rpc('update_booking_status_no_check', {
                                        p_booking_id: bookingId,
                                        p_new_status: 'paid',
                                    });
                                    if (
                                        fallbackRpcErr &&
                                        !fallbackRpcErr.message?.includes('function') &&
                                        !fallbackRpcErr.message?.includes('does not exist')
                                    ) {
                                        await admin.from('bookings').update({ status: 'paid' }).eq('id', bookingId);
                                    }
                                } else {
                                    logError('DashboardStaffShiftClose', `Error updating booking ${bookingId} to paid`, rpcErr);
                                }
                            } catch (e) {
                                logError('DashboardStaffShiftClose', `Error updating booking ${bookingId} status`, e);
                            }
                        }
                    } catch (e) {
                        logError('DashboardStaffShiftClose', 'Unexpected error updating bookings to paid', e);
                    }
                }

                const todayStart = `${ymd}T00:00:00`;
                const todayEnd = `${ymd}T23:59:59`;

                const { data: todayBookings, error: bookingsError } = await admin
                    .from('bookings')
                    .select('id, status')
                    .eq('staff_id', staffId)
                    .gte('start_at', todayStart)
                    .lte('start_at', todayEnd)
                    .neq('status', 'cancelled');

                if (!bookingsError && todayBookings) {
                    const notAddedBookings = todayBookings.filter(
                        (b) =>
                            !allBookingIdsForStatusUpdate.has(b.id) &&
                            b.status !== 'no_show' &&
                            b.status !== 'paid' &&
                            b.status !== 'confirmed'
                    );

                    for (const booking of notAddedBookings) {
                        try {
                            const { error: rpcErr } = await admin.rpc('update_booking_status_no_check', {
                                p_booking_id: booking.id,
                                p_new_status: 'no_show',
                            });
                            if (
                                rpcErr &&
                                !rpcErr.message?.includes('function') &&
                                !rpcErr.message?.includes('does not exist')
                            ) {
                                await admin.from('bookings').update({ status: 'no_show' }).eq('id', booking.id);
                            }
                        } catch (e) {
                            logError('DashboardStaffShiftClose', `Error updating booking ${booking.id} to no_show`, e);
                        }
                    }
                }

                let staffEmail: string | null = null;
                if (staff.user_id) {
                    const { data: userData } = await admin.auth.admin.getUserById(staff.user_id);
                    staffEmail = userData?.user?.email || null;
                }

                let ownerEmail: string | null = null;
                const { data: ownerData } = await admin
                    .from('businesses')
                    .select('owner_id')
                    .eq('id', bizId)
                    .maybeSingle();

                if (ownerData?.owner_id) {
                    const { data: ownerUserData } = await admin.auth.admin.getUserById(ownerData.owner_id);
                    ownerEmail = ownerUserData?.user?.email || null;
                }

                if (staffEmail) {
                    sendShiftCloseNotification({
                        staffName: staff.full_name || 'Сотрудник',
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
                    }).catch((err) => {
                        logError('DashboardStaffShiftClose', 'Failed to send shift close notification', err);
                    });
                }

                return createSuccessResponse({ shift: updated });
            });
        });
    });
}
