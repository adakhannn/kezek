// apps/web/src/app/api/bookings/[id]/mark-attendance/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
    decideMarkAttendanceUseCase,
    normalizePromotionApplied,
    type MarkAttendanceDecision,
    type PromotionApplicationResult,
} from '@core-domain/booking';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { measurePerformance } from '@/lib/performance';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { SupabaseBookingRepository } from '@/lib/repositories';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { markAttendanceSchema } from '@/lib/validation/schemas';

/**
 * @swagger
 * /api/bookings/{id}/mark-attendance:
 *   post:
 *     summary: Отметка посещения клиента (пришел/не пришел)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID бронирования
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - attended
 *             properties:
 *               attended:
 *                 type: boolean
 *                 description: true = пришел, false = не пришел
 *     responses:
 *       '200':
 *         description: Посещение отмечено, промоакция применена (если применима)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *       '400':
 *         description: Неверные параметры или бронирование не найдено
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '403':
 *         description: Нет доступа (только менеджеры бизнеса)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Бронирование не найдено
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
type Body = {
    attended: boolean; // true = пришел, false = не пришел
};

// PromotionApplicationResult импортирован из @core-domain/booking

export async function POST(req: Request, context: unknown) {
    // Применяем rate limiting для обычной операции
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        async () => {
            return withErrorHandler('BookingsMarkAttendance', async () => {
                // Валидация UUID для предотвращения потенциальных проблем безопасности
                const bookingId = await getRouteParamUuid(context, 'id');
                const { bizId } = await getBizContextForManagers();
                const admin = getServiceClient();

                // Валидация запроса
                const validationResult = await validateRequest(req, markAttendanceSchema);
                if (!validationResult.success) {
                    return validationResult.response;
                }
                const { attended } = validationResult.data;

                const bookingRepository = new SupabaseBookingRepository(admin);

                const decision: MarkAttendanceDecision = await decideMarkAttendanceUseCase(
                    {
                        bookingRepository,
                    },
                    {
                        bookingId,
                        bizId,
                        attended,
                    },
                );

                if (!decision.ok) {
                    if (decision.reason === 'BOOKING_NOT_FOUND') {
                        return createErrorResponse('not_found', 'Бронь не найдена', undefined, 404);
                    }

                    if (decision.reason === 'BOOKING_NOT_IN_BIZ') {
                        return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                    }

                    if (decision.reason === 'BOOKING_NOT_IN_PAST') {
                        return createErrorResponse(
                            'validation',
                            'Можно отмечать посещение только для прошедших броней',
                            undefined,
                            400,
                        );
                    }

                    if (decision.reason === 'BOOKING_ALREADY_FINAL') {
                        return createSuccessResponse(undefined, { status: decision.currentStatus });
                    }

                    return createErrorResponse('internal', 'Неизвестная ошибка при отметке посещения', undefined, 500);
                }

                const { newStatus, applyPromotion } = decision;

                const rpcFunctionName =
                    newStatus === 'paid'
                        ? 'update_booking_status_with_promotion'
                        : 'update_booking_status_no_check';

                const { error: rpcError, data: promotionResult } = await measurePerformance(
                    applyPromotion ? 'apply_promotion' : 'update_booking_status',
                    async () =>
                        admin.rpc(rpcFunctionName, {
                            p_booking_id: bookingId,
                            p_new_status: newStatus,
                        }),
                    { bookingId, newStatus, rpcFunctionName },
                );

                if (!rpcError) {
                    const result: PromotionApplicationResult = promotionResult;
                    if (newStatus === 'paid' && result) {
                        const applied = result.applied || false;
                        const promotionApplied = normalizePromotionApplied(result);

                        return createSuccessResponse(undefined, {
                            status: newStatus,
                            promotion_applied: applied,
                            promotion_info:
                                applied && promotionApplied
                                    ? {
                                          title: promotionApplied.promotion_title || '',
                                          discount_percent: promotionApplied.discount_percent || 0,
                                          discount_amount: promotionApplied.discount_amount || 0,
                                          final_amount: promotionApplied.final_amount || 0,
                                      }
                                    : null,
                        });
                    }
                    return createSuccessResponse(undefined, { status: newStatus });
                }

                if (
                    rpcError &&
                    (rpcError.message?.includes('function') ||
                        rpcError.message?.includes('does not exist') ||
                        rpcError.message?.includes('schema cache'))
                ) {
                    const { error: updateError } = await admin
                        .from('bookings')
                        .update({ status: newStatus })
                        .eq('id', bookingId)
                        .select('id, status');

                    if (updateError) {
                        const errorMsg = updateError.message.toLowerCase();

                        if (errorMsg.includes('not assigned to branch') || errorMsg.includes('staff')) {
                            const { data: checkData } = await admin
                                .from('bookings')
                                .select('status')
                                .eq('id', bookingId)
                                .maybeSingle();

                            if (checkData && checkData.status === newStatus) {
                                return createSuccessResponse(undefined, { status: newStatus });
                            }

                            return createErrorResponse(
                                'validation',
                                'Не удалось обновить статус. Возможно, сотрудник больше не назначен на филиал.',
                                undefined,
                                400,
                            );
                        }

                        return createErrorResponse('validation', updateError.message, undefined, 400);
                    }

                    return createSuccessResponse(undefined, { status: newStatus });
                }

                return createErrorResponse('validation', rpcError?.message || 'Неизвестная ошибка', undefined, 400);
            });
        }
    );
}

