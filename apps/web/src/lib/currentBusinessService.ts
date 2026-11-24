import { BusinessAccessReadError, managerAccessToBusiness } from './businessManagerAccess';

import type { DbAuthClient, DbTableClient } from '@/lib/supabaseTypes';

const ALLOWED_ROLE_KEYS = new Set(['owner', 'admin', 'manager']);

const readFailure = (details: unknown): Failure => ({
    ok: false,
    error: 'internal',
    message: 'Не удалось проверить бизнесы. Повторите попытку.',
    details,
    status: 500,
});

type BusinessListItem = {
    id: string;
    name: string | null;
    city: string | null;
    slug: string | null;
};

type Failure = {
    ok: false;
    error: string;
    message: string;
    details?: unknown;
    status: number;
};

export async function getCurrentBusinessState({
    supabase,
    admin,
}: {
    supabase: DbAuthClient;
    admin: DbTableClient;
}): Promise<
    | {
          ok: true;
          data: {
              currentBizId: string | null;
              businesses: BusinessListItem[];
          };
      }
    | Failure
> {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { ok: false, error: 'auth', message: 'Не авторизован', status: 401 };
    }

    const userId = user.id;

    const [
        { data: current, error: currentError },
        { data: ownedBusinesses, error: ownedError },
        { data: roleBusinesses, error: roleError },
    ] = await Promise.all([
        admin.from('user_current_business').select('biz_id').eq('user_id', userId).maybeSingle(),
        admin.from('businesses').select('id, name, slug').eq('owner_id', userId),
        admin.from('user_roles').select('biz_id, role_id').eq('user_id', userId).not('biz_id', 'is', null),
    ]);
    // A partial list would show the wrong businesses and current choice.
    if (currentError || ownedError || roleError) return readFailure((currentError ?? ownedError ?? roleError)?.message);

    const bizMap = new Map<string, BusinessListItem>();
    (ownedBusinesses ?? []).forEach((business: { id: string; name: string | null; slug: string | null }) => {
        bizMap.set(business.id, {
            id: business.id,
            name: business.name ?? null,
            city: null,
            slug: business.slug ?? null,
        });
    });

    if (roleBusinesses?.length) {
        const { data: roleRows, error: roleKeysError } = await admin.from('roles').select('id, key');
        if (roleKeysError) return readFailure(roleKeysError.message);
        const roleKeyById = new Map<string, string>((roleRows ?? []).map((role: { id: string; key: string }) => [role.id, role.key]));
        const allowedBizIds = new Set<string>();

        roleBusinesses.forEach((role: { biz_id: string | null; role_id: string }) => {
            if (!role.biz_id) {
                return;
            }
            const key = roleKeyById.get(role.role_id);
            if (key && ALLOWED_ROLE_KEYS.has(key)) {
                allowedBizIds.add(role.biz_id);
            }
        });

        const missingIds = [...allowedBizIds].filter((id) => !bizMap.has(id));
        if (missingIds.length > 0) {
            const { data: bizRows, error: bizRowsError } = await admin.from('businesses').select('id, name, slug').in('id', missingIds);
            if (bizRowsError) return readFailure(bizRowsError.message);
            (bizRows ?? []).forEach((business: { id: string; name: string | null; slug: string | null }) => {
                bizMap.set(business.id, {
                    id: business.id,
                    name: business.name ?? null,
                    city: null,
                    slug: business.slug ?? null,
                });
            });
        }
    }

    return {
        ok: true,
        data: {
            currentBizId: current?.biz_id ?? null,
            businesses: Array.from(bizMap.values()),
        },
    };
}

export async function setCurrentBusinessState({
    supabase,
    admin,
    bizId,
}: {
    supabase: DbAuthClient;
    admin: DbTableClient;
    bizId: string | null;
}): Promise<{ ok: true } | Failure> {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { ok: false, error: 'auth', message: 'Не авторизован', status: 401 };
    }

    if (!bizId) {
        return { ok: false, error: 'validation', message: 'bizId обязателен', status: 400 };
    }

    const userId = user.id;
    let access: Awaited<ReturnType<typeof managerAccessToBusiness>>;
    try {
        access = await managerAccessToBusiness(admin, userId, bizId);
    } catch (error) {
        if (error instanceof BusinessAccessReadError) return readFailure(error.step);
        throw error;
    }
    if (access === 'missing') {
        return { ok: false, error: 'not_found', message: 'Бизнес не найден', status: 404 };
    }
    if (access === 'none') {
        return { ok: false, error: 'forbidden', message: 'Нет прав на этот бизнес', status: 403 };
    }

    const { error: upsertError } = await admin
        .from('user_current_business')
        .upsert({ user_id: userId, biz_id: bizId }, { onConflict: 'user_id' });

    if (upsertError) {
        return {
            ok: false,
            error: 'internal',
            message: 'Не удалось сохранить текущий бизнес',
            details: upsertError.message,
            status: 500,
        };
    }

    return { ok: true };
}
