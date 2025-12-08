import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ROLE_KEYS_ALLOWED = new Set(['owner', 'admin', 'manager']);

export async function getSupabaseServer() {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    return createServerClient(url, anon, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value,
            set: () => {},
            remove: () => {},
        },
    });
}

/**
 * Возвращает { supabase, userId, bizId } для кабинета менеджмента.
 * Порядок определения:
 * 1) super_admin → slug=kezek или любой бизнес
 * 2) роли user_roles (owner|admin|manager)
 * 3) Фоллбек: businesses.owner_id = user.id
 */
export async function getBizContextForManagers() {
    const supabase = await getSupabaseServer();

    // 1) юзер обязателен
    const { data: userData, error: eUser } = await supabase.auth.getUser();
    if (eUser || !userData?.user) throw new Error('UNAUTHORIZED');
    const userId = userData.user.id;

    // 2) super_admin через RPC (быстро и без RLS-заморочек)
    let isSuper = false;
    try {
        const { data: isSuperRes } = await supabase.rpc('is_super_admin');
        isSuper = !!isSuperRes;
    } catch {
        // если RPC нет — считаем, что не супер
        isSuper = false;
    }

    // 3) выбрать бизнес
    let bizId: string | undefined;

    if (isSuper) {
        // Kezek в приоритете
        const { data: bizKezek } = await supabase
            .from('businesses')
            .select('id')
            .eq('slug', 'kezek')
            .maybeSingle();

        if (bizKezek?.id) {
            bizId = bizKezek.id;
        } else {
            const { data: anyBiz } = await supabase
                .from('businesses')
                .select('id')
                .limit(1)
                .maybeSingle();
            bizId = anyBiz?.id;
        }
    } else {
        // (a) ищем по user_roles, но без JOIN, затем мапим role_id -> key
        const [{ data: ur }, { data: roleRows }] = await Promise.all([
            supabase.from('user_roles').select('biz_id, role_id').eq('user_id', userId),
            supabase.from('roles').select('id, key'),
        ]);

        if (ur && roleRows) {
            const rolesMap = new Map<string, string>(roleRows.map(r => [String(r.id), String(r.key)]));
            const eligible = ur.find(r => ROLE_KEYS_ALLOWED.has(rolesMap.get(String(r.role_id)) || ''));
            if (eligible?.biz_id) bizId = String(eligible.biz_id);
        }

        // (b) если ролей нет — фоллбек по полю owner_id
        if (!bizId) {
            const { data: owned } = await supabase
                .from('businesses')
                .select('id')
                .eq('owner_id', userId)
                .limit(1)
                .maybeSingle();

            if (owned?.id) bizId = owned.id;
        }
    }

    if (!bizId) throw new Error('NO_BIZ_ACCESS');
    return { supabase, userId, bizId };
}

/**
 * Возвращает { supabase, userId, staffId, bizId } для кабинета сотрудника.
 * Проверяет, что пользователь имеет роль staff в каком-либо бизнесе.
 */
export async function getStaffContext() {
    const supabase = await getSupabaseServer();

    // 1) юзер обязателен
    const { data: userData, error: eUser } = await supabase.auth.getUser();
    if (eUser || !userData?.user) throw new Error('UNAUTHORIZED');
    const userId = userData.user.id;

    // 2) Проверяем роль staff через user_roles
    const [{ data: ur }, { data: roleRows }] = await Promise.all([
        supabase.from('user_roles').select('biz_id, role_id').eq('user_id', userId),
        supabase.from('roles').select('id, key'),
    ]);

    if (!ur || !roleRows) throw new Error('NO_STAFF_ACCESS');

    const rolesMap = new Map<string, string>(roleRows.map(r => [String(r.id), String(r.key)]));
    const staffRole = ur.find(r => rolesMap.get(String(r.role_id)) === 'staff');
    
    if (!staffRole?.biz_id) throw new Error('NO_STAFF_ACCESS');
    const bizId = String(staffRole.biz_id);

    // 3) Находим запись staff по user_id и biz_id
    const { data: staff } = await supabase
        .from('staff')
        .select('id, full_name, branch_id, is_active')
        .eq('biz_id', bizId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

    if (!staff) throw new Error('NO_STAFF_RECORD');

    return { supabase, userId, staffId: staff.id, bizId, branchId: staff.branch_id };
}

