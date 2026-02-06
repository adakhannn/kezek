// apps/web/src/app/api/bookings/[id]/mark-attendance/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { measurePerformance } from '@/lib/performance';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

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

type PromotionRpcResult = {
    applied?: boolean;
    promotion_title?: string | null;
    discount_percent?: number | null;
    discount_amount?: number | null;
    final_amount?: number | null;
} | null;

export async function POST(req: Request, context: unknown) {
    // Применяем rate limiting для обычной операции
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        async () => {
            return withErrorHandler('BookingsMarkAttendance', async () => {
                const bookingId = await getRouteParamRequired(context, 'id');
                const { bizId } = await getBizContextForManagers();
                const admin = getServiceClient();

                const body = await req.json().catch(() => ({} as Body));
                const attended = body.attended === true;

                // Проверяем, что бронь принадлежит этому бизнесу
                const { data: booking, error: bookingError } = await admin
                    .from('bookings')
                    .select('id, biz_id, start_at, status')
                    .eq('id', bookingId)
                    .maybeSingle();

                if (bookingError) {
                    return createErrorResponse('validation', bookingError.message, undefined, 400);
                }

                if (!booking) {
                    return createErrorResponse('not_found', 'Бронь не найдена', undefined, 404);
                }

                if (String(booking.biz_id) !== String(bizId)) {
                    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                }

                // Если статус уже финальный, не пытаемся применять его повторно
                if (booking.status === 'paid' || booking.status === 'no_show') {
                    return createSuccessResponse(undefined, { status: booking.status });
                }

                // Проверяем, что бронь уже прошла
                const now = new Date();
                const startAt = new Date(booking.start_at);
                if (startAt > now) {
                    return createErrorResponse('validation', 'Можно отмечать посещение только для прошедших броней', undefined, 400);
                }

        // Обновляем статус: attended = true -> paid (выполнено/пришел), attended = false -> no_show
        // Примечание: статус "paid" означает "выполнено/пришел", а не "оплачено"
        const newStatus = attended ? 'paid' : 'no_show';

        // Если статус = 'paid', используем функцию с автоматическим применением акций
        // Иначе используем стандартную функцию обновления статуса
        const rpcFunctionName = newStatus === 'paid' 
            ? 'update_booking_status_with_promotion' 
            : 'update_booking_status_no_check';

        // Применяем статус (и акцию, если статус = 'paid')
        // Мониторинг производительности применения промо
        const { error: rpcError, data: promotionResult } = await measurePerformance(
            newStatus === 'paid' ? 'apply_promotion' : 'update_booking_status',
            async () => {
                return await admin.rpc(rpcFunctionName, {
                    p_booking_id: bookingId,
                    p_new_status: newStatus,
                });
            },
            { bookingId, newStatus, rpcFunctionName }
        );

        // Если RPC успешно выполнен, возвращаем успех
        if (!rpcError) {
            // Если применялась акция, возвращаем информацию о ней
            const result: PromotionRpcResult = promotionResult;
            if (newStatus === 'paid' && result) {
                const applied = result.applied || false;
                
                return createSuccessResponse(undefined, { 
                    status: newStatus,
                    promotion_applied: applied,
                    promotion_info: applied ? {
                        title: result?.promotion_title || '',
                        discount_percent: result?.discount_percent || 0,
                        discount_amount: result?.discount_amount || 0,
                        final_amount: result?.final_amount || 0,
                    } : null,
                });
            }
            return createSuccessResponse(undefined, { status: newStatus });
        }

        // Если RPC функция не найдена или не работает, используем прямой update через service client
        // Service client должен обходить большинство проверок
        if (rpcError && (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist') || rpcError.message?.includes('schema cache'))) {
            // Fallback: прямой update через service client
            const { error: updateError } = await admin
                .from('bookings')
                .update({ status: newStatus })
                .eq('id', bookingId)
                .select('id, status');

            if (updateError) {
                const errorMsg = updateError.message.toLowerCase();
                // Если ошибка о назначении сотрудника, это не критично для прошедших броней
                // Бронь уже существует, и мы просто меняем её статус
                if (errorMsg.includes('not assigned to branch') || errorMsg.includes('staff')) {
                    // Для прошедших броней игнорируем ошибку о назначении
                    // Проверяем, что статус все же обновился
                    const { data: checkData } = await admin
                        .from('bookings')
                        .select('status')
                        .eq('id', bookingId)
                        .maybeSingle();
                    
                    if (checkData && checkData.status === newStatus) {
                        // Статус обновился, несмотря на ошибку
                        return createSuccessResponse(undefined, { status: newStatus });
                    }
                    
                    // Если статус не обновился, возвращаем ошибку
                    return createErrorResponse('validation', 'Не удалось обновить статус. Возможно, сотрудник больше не назначен на филиал.', undefined, 400);
                } else {
                    return createErrorResponse('validation', updateError.message, undefined, 400);
                }
            }
            
            // Успешно обновлено
            return createSuccessResponse(undefined, { status: newStatus });
        }

                // Если это не ошибка "функция не найдена", возвращаем ошибку RPC
                return createErrorResponse('validation', rpcError?.message || 'Неизвестная ошибка', undefined, 400);
            });
        }
    );
}

