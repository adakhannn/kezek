export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cancelAccountDeletion, getAccountDeletionState, requestAccountDeletion } from '@/lib/accountDeletionService';
import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

async function context() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { user, admin: createSupabaseAdminClient() };
}

export async function GET() {
    const { user, admin } = await context();
    if (!user) return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    try {
        return createSuccessResponse(await getAccountDeletionState(admin as never, user.id));
    } catch (error) {
        return createErrorResponse('internal', error instanceof Error ? error.message : 'Ошибка проверки аккаунта', undefined, 500);
    }
}

export async function POST(request: Request) {
    const { user, admin } = await context();
    if (!user) return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    let confirmation = '';
    try {
        confirmation = String(((await request.json()) as { confirmation?: unknown }).confirmation ?? '');
    } catch {
        return createErrorResponse('validation', 'Неверный формат запроса', undefined, 400);
    }
    try {
        const result = await requestAccountDeletion(admin as never, user.id, confirmation);
        if (!result.ok) return createErrorResponse('validation', result.message, { code: result.code, blockers: result.blockers }, result.status);
        return createSuccessResponse(result);
    } catch (error) {
        return createErrorResponse('internal', error instanceof Error ? error.message : 'Ошибка запроса удаления', undefined, 500);
    }
}

export async function DELETE() {
    const { user, admin } = await context();
    if (!user) return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    try {
        return createSuccessResponse(await cancelAccountDeletion(admin as never, user.id));
    } catch (error) {
        return createErrorResponse('internal', error instanceof Error ? error.message : 'Ошибка отмены удаления', undefined, 500);
    }
}
