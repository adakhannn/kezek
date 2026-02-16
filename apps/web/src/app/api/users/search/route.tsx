export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { usersSearchSchema } from '@/lib/validation/schemas';

/**
 * POST /api/users/search
 * Body: { q?: string, page?: number, perPage?: number }
 * Возвращает: { ok: true, items: [{ id, email, phone, full_name }], page, perPage, total? }
 *
 * Поведение:
 * - если q пустая → вернёт первую страницу пользователей (по умолчанию 50).
 * - если q задана → вернёт пользователей, у кого email/phone/имя содержит q.
 */
export async function POST(req: Request) {
    return withErrorHandler('UsersSearch', async () => {
        // Доступ сюда уже ограничен getBizContextForManagers (owner/admin/manager ИЛИ владелец по owner_id)
        const { supabase, bizId } = await getBizContextForManagers();

        // Валидация запроса
        const validationResult = await validateRequest(req, usersSearchSchema);
        if (!validationResult.success) {
            return validationResult.response;
        }
        const { q, page, perPage } = validationResult.data;
        
        // Валидация и санитизация входных данных для предотвращения проблем безопасности
        const query = (q ?? '').trim().slice(0, 100).toLowerCase(); // Ограничиваем длину поискового запроса
        const pageNum = Math.max(1, Math.min(100, page)); // Ограничиваем page от 1 до 100
        const perPageNum = Math.max(1, Math.min(100, perPage)); // Ограничиваем perPage от 1 до 100

        const admin = getServiceClient();
        const { data, error } = await admin.auth.admin.listUsers({ page: pageNum, perPage: perPageNum });

        if (error) {
            return createErrorResponse('validation', error.message, undefined, 400);
        }

        const users = data.users ?? [];

        // Получаем список user_id всех сотрудников текущего бизнеса
        const { data: existingStaff } = await supabase
            .from('staff')
            .select('user_id')
            .eq('biz_id', bizId)
            .not('user_id', 'is', null);

        const existingStaffUserIds = new Set(
            (existingStaff ?? [])
                .map(s => s.user_id)
                .filter((id): id is string => typeof id === 'string' && id !== null)
        );

        // маппинг и фильтрация
        const mapped = users
            .map(u => {
                const meta = (u.user_metadata ?? {});
                return {
                    id: u.id,
                    email: u.email ?? null,
                    phone: u.phone ?? null,
                    full_name: meta.full_name ?? meta.fullName ?? u.email ?? 'Без имени',
                };
            })
            // Исключаем пользователей, которые уже являются сотрудниками этого бизнеса
            .filter(u => !existingStaffUserIds.has(u.id));

        const items = query
            ? mapped.filter(u =>
                (u.email ?? '').toLowerCase().includes(query) ||
                (u.phone ?? '').includes(query) ||
                (u.full_name ?? '').toLowerCase().includes(query),
            )
            : mapped;

        return createSuccessResponse(undefined, { items, page, perPage });
    });
}
