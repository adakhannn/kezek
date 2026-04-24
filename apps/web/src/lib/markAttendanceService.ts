import {
    decideMarkAttendanceUseCase,
    normalizePromotionApplied,
    type MarkAttendanceDecision,
    type PromotionApplicationResult,
} from '@core-domain/booking';

import { measurePerformance } from '@/lib/performance';
import { SupabaseBookingRepository } from '@/lib/repositories';

type Result =
    | {
          ok: false;
          statusCode: 400 | 403 | 404 | 500;
          errorType: 'validation' | 'forbidden' | 'not_found' | 'internal';
          message: string;
      }
    | {
          ok: true;
          payload: Record<string, unknown>;
      };

export async function runMarkAttendance({
    admin,
    bookingId,
    bizId,
    attended,
}: {
    admin: any;
    bookingId: string;
    bizId: string;
    attended: boolean;
}): Promise<Result> {
    const bookingRepository = new SupabaseBookingRepository(admin);

    const decision: MarkAttendanceDecision = await decideMarkAttendanceUseCase(
        { bookingRepository },
        {
            bookingId,
            bizId,
            attended,
        },
    );

    if (!decision.ok) {
        if (decision.reason === 'BOOKING_NOT_FOUND') {
            return {
                ok: false,
                statusCode: 404,
                errorType: 'not_found',
                message: 'Бронь не найдена',
            };
        }

        if (decision.reason === 'BOOKING_NOT_IN_BIZ') {
            return {
                ok: false,
                statusCode: 403,
                errorType: 'forbidden',
                message: 'Доступ запрещен',
            };
        }

        if (decision.reason === 'BOOKING_NOT_IN_PAST') {
            return {
                ok: false,
                statusCode: 400,
                errorType: 'validation',
                message: 'Можно отмечать посещение только для прошедших броней',
            };
        }

        if (decision.reason === 'BOOKING_ALREADY_FINAL') {
            return {
                ok: true,
                payload: { status: decision.currentStatus },
            };
        }

        return {
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: 'Неизвестная ошибка при отметке посещения',
        };
    }

    const { newStatus, applyPromotion } = decision;
    const rpcFunctionName =
        newStatus === 'paid' ? 'update_booking_status_with_promotion' : 'update_booking_status_no_check';

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
        const result = promotionResult as PromotionApplicationResult & {
            plan_id?: string;
            plan_name_ru?: string;
            promotion_title?: string;
            final_amount?: number;
            remaining_after?: number;
        };

        if (newStatus === 'paid' && result) {
            const applied = result.applied || false;
            const promotionApplied = normalizePromotionApplied(result);
            const isPackage = Boolean(result.plan_id);
            const title =
                result.plan_name_ru ??
                result.promotion_title ??
                promotionApplied?.promotion_title ??
                '';

            return {
                ok: true,
                payload: {
                    status: newStatus,
                    promotion_applied: applied && !isPackage,
                    subscription_applied: applied && isPackage,
                    promotion_info:
                        applied && (promotionApplied || title)
                            ? {
                                  title,
                                  discount_percent: promotionApplied?.discount_percent ?? 0,
                                  discount_amount: promotionApplied?.discount_amount ?? 0,
                                  final_amount: promotionApplied?.final_amount ?? result.final_amount ?? 0,
                              }
                            : null,
                },
            };
        }

        return {
            ok: true,
            payload: { status: newStatus },
        };
    }

    if (
        rpcError.message?.includes('function') ||
        rpcError.message?.includes('does not exist') ||
        rpcError.message?.includes('schema cache')
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
                    return {
                        ok: true,
                        payload: { status: newStatus },
                    };
                }

                return {
                    ok: false,
                    statusCode: 400,
                    errorType: 'validation',
                    message:
                        'Не удалось обновить статус. Возможно, сотрудник больше не назначен на филиал.',
                };
            }

            return {
                ok: false,
                statusCode: 400,
                errorType: 'validation',
                message: updateError.message,
            };
        }

        return {
            ok: true,
            payload: { status: newStatus },
        };
    }

    return {
        ok: false,
        statusCode: 400,
        errorType: 'validation',
        message: rpcError?.message || 'Неизвестная ошибка',
    };
}

