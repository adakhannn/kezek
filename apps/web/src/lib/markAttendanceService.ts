import { measurePerformance } from '@/lib/performanceServer';
import type { FinanceCommandClient } from '@/lib/staffShift/financeCommand';

type Result = { ok: true; payload: Record<string, unknown> } | {
    ok: false; statusCode: 400 | 403 | 404 | 409 | 500;
    errorType: 'validation' | 'forbidden' | 'not_found' | 'internal'; message: string;
};
export async function runMarkAttendance({ admin, bookingId, bizId, actorId, attended }: {
    admin: FinanceCommandClient; bookingId: string; bizId: string; actorId: string; attended: boolean;
}): Promise<Result> {
    if (!actorId) return { ok: false, statusCode: 403, errorType: 'forbidden', message: 'Доступ запрещен' };
    const { data, error } = await measurePerformance(attended ? 'apply_promotion' : 'update_booking_status', async () =>
        await admin.rpc('mark_booking_attendance_command', { p_booking_id: bookingId, p_biz_id: bizId, p_actor_id: actorId, p_attended: attended }));
    if (error) {
        if (error.code === '42501') return { ok: false, statusCode: 403, errorType: 'forbidden', message: 'Доступ запрещен' };
        if (error.code === 'P0002') return { ok: false, statusCode: 404, errorType: 'not_found', message: 'Бронь не найдена' };
        if (error.code === '22023') return { ok: false, statusCode: 400, errorType: 'validation', message: 'Можно отмечать посещение только для прошедших броней' };
        if (error.code === '40001') return { ok: false, statusCode: 409, errorType: 'validation', message: 'Статус или финансовые данные брони изменились. Требуется проверка; автоматическое исправление не выполнено.' };
        return { ok: false, statusCode: 500, errorType: 'internal', message: 'Отметка посещения не подтверждена. Проверьте состояние брони перед повтором.' };
    }
    const receipt = data as Record<string, unknown> | null;
    if (!receipt || receipt.ok !== true || receipt.status !== (attended ? 'paid' : 'no_show') ||
        typeof receipt.promotion_applied !== 'boolean' || typeof receipt.subscription_applied !== 'boolean' ||
        !('promotion_info' in receipt)) return { ok: false, statusCode: 500, errorType: 'internal', message: 'Отметка посещения не подтверждена.' };
    return { ok: true, payload: { status: receipt.status, promotion_applied: receipt.promotion_applied,
        subscription_applied: receipt.subscription_applied, promotion_info: receipt.promotion_info } };
}
