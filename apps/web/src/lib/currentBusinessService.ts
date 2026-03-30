const ALLOWED_ROLE_KEYS = new Set(['owner', 'admin', 'manager']);

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

export type CurrentBusinessServerClientLike = {
    auth: {
        getUser: () => Promise<{ data: { user: { id: string } | null } }>;
    };
};

export type CurrentBusinessAdminClientLike = {
    from: (table: string) => any;
};

export async function getCurrentBusinessState({
    supabase,
    admin,
}: {
    supabase: CurrentBusinessServerClientLike;
    admin: CurrentBusinessAdminClientLike;
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

    const [{ data: current }, { data: ownedBusinesses }, { data: roleBusinesses }] = await Promise.all([
        admin.from('user_current_business').select('biz_id').eq('user_id', userId).maybeSingle(),
        admin.from('businesses').select('id, name, slug').eq('owner_id', userId),
        admin.from('user_roles').select('biz_id, role_id').eq('user_id', userId).not('biz_id', 'is', null),
    ]);

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
        const { data: roleRows } = await admin.from('roles').select('id, key');
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
            const { data: bizRows } = await admin.from('businesses').select('id, name, slug').in('id', missingIds);
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
    supabase: CurrentBusinessServerClientLike;
    admin: CurrentBusinessAdminClientLike;
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

    const { data: biz } = await admin.from('businesses').select('id, owner_id').eq('id', bizId).maybeSingle();
    if (!biz) {
        return { ok: false, error: 'not_found', message: 'Бизнес не найден', status: 404 };
    }

    const userId = user.id;
    let hasAccess = biz.owner_id === userId;

    if (!hasAccess) {
        const { data: urRows } = await admin.from('user_roles').select('role_id').eq('user_id', userId).eq('biz_id', bizId);
        if (urRows?.length) {
            const roleIds = [...new Set((urRows as { role_id: string }[]).map((row) => row.role_id))];
            const { data: roleRows } = await admin.from('roles').select('id, key').in('id', roleIds);
            const keySet = new Set((roleRows ?? []).map((row: { key: string }) => row.key));
            hasAccess = [...ALLOWED_ROLE_KEYS].some((key) => keySet.has(key));
        }
    }

    if (!hasAccess) {
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
