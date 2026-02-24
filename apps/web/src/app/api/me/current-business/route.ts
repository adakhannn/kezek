import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Допустимые роли для владения/управления бизнесом
const ALLOWED_ROLE_KEYS = new Set(['owner', 'admin', 'manager']);

export async function GET() {
    return withErrorHandler('GetCurrentBusiness', async () => {
        const { supabase } = await createSupabaseClients();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        // Текущий бизнес (если уже выбран)
        const { data: current } = await supabase
            .from('user_current_business')
            .select('biz_id')
            .eq('user_id', user.id)
            .maybeSingle<{ biz_id: string }>();

        // Доступные бизнесы для пользователя:
        // 1) где он owner
        // 2) где у него роль owner/admin/manager через user_roles
        const { data: ownedBusinesses } = await supabase
            .from('businesses')
            .select('id, name, city, slug')
            .eq('owner_id', user.id);

        const { data: roleBusinesses } = await supabase
            .from('user_roles')
            .select('biz_id, roles:key!inner(key)')
            .eq('user_id', user.id)
            .not('biz_id', 'is', null);

        const bizMap = new Map<string, { id: string; name: string | null; city: string | null; slug: string | null }>();

        (ownedBusinesses ?? []).forEach((b) => {
            bizMap.set(b.id, { id: b.id, name: b.name ?? null, city: b.city ?? null, slug: b.slug ?? null });
        });

        // user_roles может содержать несколько записей по одному biz_id — фильтруем по ролям и мержим
        const roleBizRows = (roleBusinesses ?? []) as Array<{
            biz_id: string | null;
            roles: { key: string }[] | null;
        }>;

        roleBizRows.forEach((r) => {
            if (!r.biz_id) return;
            const roleKey = r.roles?.[0]?.key;
            if (!roleKey || !ALLOWED_ROLE_KEYS.has(roleKey)) return;
            if (!bizMap.has(r.biz_id)) {
                // Если бизнес ещё не в мапе, попробуем вытащить базовую инфу через businesses
                // Но чтобы не плодить дополнительные запросы, просто сохраним id, остальные поля null
                bizMap.set(r.biz_id, { id: r.biz_id, name: null, city: null, slug: null });
            }
        });

        const businesses = Array.from(bizMap.values());

        return createSuccessResponse({
            currentBizId: current?.biz_id ?? null,
            businesses,
        });
    });
}

export async function POST(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.auth,
        () => withErrorHandler('SetCurrentBusiness', async () => {
            const { supabase, admin } = await createSupabaseClients();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return createErrorResponse('auth', 'Не авторизован', undefined, 401);
            }

            const body = await req.json().catch(() => ({}));
            const bizId = typeof body.bizId === 'string' ? body.bizId.trim() : null;

            if (!bizId) {
                return createErrorResponse('validation', 'bizId обязателен', undefined, 400);
            }

            // Проверяем, что бизнес существует
            const { data: biz } = await admin
                .from('businesses')
                .select('id, owner_id')
                .eq('id', bizId)
                .maybeSingle<{ id: string; owner_id: string | null }>();

            if (!biz) {
                return createErrorResponse('not_found', 'Бизнес не найден', undefined, 404);
            }

            const userId = user.id;

            // Проверяем права пользователя:
            // 1) он владелец бизнеса, ИЛИ
            // 2) у него есть роль owner/admin/manager в этом бизнесе
            let hasAccess = false;

            if (biz.owner_id === userId) {
                hasAccess = true;
            } else {
                const { data: roles } = await admin
                    .from('user_roles')
                    .select('role_id, roles:key!inner(key)')
                    .eq('user_id', userId)
                    .eq('biz_id', bizId);

                if (roles && roles.length > 0) {
                    const roleRows = roles as Array<{ roles: { key: string }[] | null }>;
                    hasAccess = roleRows.some((r) => {
                        const key = r.roles?.[0]?.key;
                        return !!key && ALLOWED_ROLE_KEYS.has(key);
                    });
                }
            }

            if (!hasAccess) {
                return createErrorResponse('forbidden', 'Нет прав на этот бизнес', undefined, 403);
            }

            // Сохраняем / обновляем запись о текущем бизнесе
            const { error: upsertError } = await admin
                .from('user_current_business')
                .upsert(
                    { user_id: userId, biz_id: bizId },
                    { onConflict: 'user_id' }
                );

            if (upsertError) {
                return createErrorResponse('internal', 'Не удалось сохранить текущий бизнес', upsertError.message, 500);
            }

            return createSuccessResponse();
        })
    );
}

