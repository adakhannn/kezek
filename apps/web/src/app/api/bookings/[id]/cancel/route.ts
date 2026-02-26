// apps/web/src/app/api/bookings/[id]/cancel/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
    cancelBookingUseCase,
    type BookingCommandsPort,
    type BookingNotificationPort,
} from '@core-domain/booking';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { logDebug, logError } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function POST(req: Request, context: unknown) {
    return withErrorHandler('BookingsCancel', async () => {
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const bookingId = await getRouteParamUuid(context, 'id');

        // Используем унифицированную утилиту для создания Supabase клиента
        const supabase = await createSupabaseServerClient();

        // проверим, что бронь принадлежит текущему пользователю
        const {data: b} = await supabase
            .from('bookings')
            .select('id, client_id, biz_id, status')
            .eq('id', bookingId)
            .maybeSingle();

        const {data: auth} = await supabase.auth.getUser();
        
        if (!auth.user || !b) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        // Если это клиент - проверяем, что бронь принадлежит ему
        // Если это менеджер - проверяем, что бронь принадлежит его бизнесу
        if (b.client_id === auth.user.id) {
            // Клиент отменяет свою бронь - разрешено
        } else {
            // Пытаемся проверить, является ли пользователь менеджером бизнеса
            try {
                const { bizId } = await getBizContextForManagers();
                const check = await checkBookingBelongsToBusiness(bookingId, bizId);
                if (!check.belongs) {
                    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                }
            } catch {
                // Если не менеджер - проверяем, что это клиент
                if (b.client_id !== auth.user.id) {
                    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                }
            }
        }

        // Если уже отменена, возвращаем успех
        if (b.status === 'cancelled') {
            return createSuccessResponse();
        }

        const commands: BookingCommandsPort = {
            async holdSlot() {
                throw new Error('holdSlot is not supported in cancel route');
            },
            async confirmBooking() {
                throw new Error('confirmBooking is not supported in cancel route');
            },
            async cancelBooking(id: string) {
                logDebug('BookingsCancel', 'Calling cancel_booking RPC', { bookingId: id });

                const { error } = await supabase.rpc('cancel_booking', { p_booking_id: id });

                // Если ошибка связана с назначением сотрудника, обновляем статус напрямую
                if (error) {
                    const errorMsg = error.message.toLowerCase();

                    if (errorMsg.includes('not assigned to branch') || errorMsg.includes('staff')) {
                        const { error: updateError } = await supabase
                            .from('bookings')
                            .update({ status: 'cancelled' })
                            .eq('id', id)
                            .eq('client_id', auth.user.id);

                        if (updateError) {
                            logError('BookingsCancel', 'Direct status update failed', updateError);
                            throw {
                                error: 'validation',
                                message: updateError.message,
                                status: 400,
                            } as const;
                        }
                    } else {
                        logError('BookingsCancel', 'RPC cancel_booking failed', error);
                        throw {
                            error: 'validation',
                            message: error.message,
                            status: 400,
                        } as const;
                    }
                }
            },
        };

        const notifications: BookingNotificationPort = {
            async send(id, type) {
                logDebug('BookingsCancel', 'Triggering notifications', { bookingId: id, type });

                try {
                    const notifyUrl = new URL('/api/notify', req.url);

                    const response = await fetch(notifyUrl, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ type, booking_id: id }),
                    });

                    if (!response.ok) {
                        const errorText = await response.text().catch(() => 'Unknown error');
                        logError('BookingsCancel', 'Notify API error', {
                            status: response.status,
                            errorText,
                        });
                    } else {
                        const result = await response.json().catch(() => ({}));
                        logDebug('BookingsCancel', 'Notify API success', result);
                    }
                } catch (error) {
                    logError('BookingsCancel', 'Notify API exception', error);
                }
            },
        };

        await cancelBookingUseCase(
            {
                commands,
                notifications,
            },
            bookingId,
        );

        return createSuccessResponse();
    });
}
