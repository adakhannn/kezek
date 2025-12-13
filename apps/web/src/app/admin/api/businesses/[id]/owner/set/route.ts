// apps/web/src/app/admin/api/businesses/[id]/owner/set/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import {createServerClient} from '@supabase/ssr';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import { getRouteParamRequired } from '@/lib/routeParams';


// ---------- Admin API shim (минимальные типы) ----------
type AdminUser = {
    id: string;
    email?: string | null;
    phone?: string | null;
    user_metadata?: Record<string, unknown> | null;
};

type ListUsersArgs = { page?: number; perPage?: number };
type ListUsersRes = {
    data: { users: AdminUser[]; total?: number } | null;
    error: { message: string } | null;
};

type CreateUserArgs = {
    email?: string;
    phone?: string;
    password?: string;
    email_confirm?: boolean;
    phone_confirm?: boolean;
    user_metadata?: Record<string, unknown>;
};

type CreateUserRes = {
    data: { user: AdminUser } | null;
    error: { message: string } | null;
};

interface GoTrueAdminShim {
    listUsers(args: ListUsersArgs): Promise<ListUsersRes>;

    createUser(args: CreateUserArgs): Promise<CreateUserRes>;
}

type AdminClient = SupabaseClient;

const adminAPI = (c: AdminClient): GoTrueAdminShim =>
    (c as unknown as { auth: { admin: GoTrueAdminShim } }).auth.admin;

// ---------- Данные ----------
type Body = { full_name?: string | null; email?: string | null; phone?: string | null };
type UserRoleInsert = { user_id: string; biz_id: string; role: 'owner' | 'manager' | 'staff' | 'admin' | 'client' };

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

// Поиск существующего пользователя по email/phone
async function findUserIdByEmailOrPhone(admin: AdminClient, email?: string | null, phone?: string | null) {
    const api = adminAPI(admin);
    const emailLc = email?.toLowerCase();
    const phoneNorm = phone ?? undefined;

    for (let page = 1; page <= 10; page++) {
        const {data, error} = await api.listUsers({page, perPage: 1000});
        if (error) throw new Error(error.message);

        const users = data?.users ?? [];
        const found = users.find((u) => {
            const byEmail = emailLc && (u.email ?? '').toLowerCase() === emailLc;
            const metaPhone =
                (u.user_metadata && typeof u.user_metadata === 'object'
                    ? (u.user_metadata as { phone?: string }).phone
                    : undefined) ?? undefined;
            const byPhone = phoneNorm && (u.phone === phoneNorm || metaPhone === phoneNorm);
            return Boolean(byEmail || byPhone);
        });

        if (found) return found.id;
        if (users.length < 1000) break; // последняя страница
    }
    return null;
}

// Создать пользователя
async function createUser(admin: AdminClient, payload: Body): Promise<string> {
    const api = adminAPI(admin);
    const email = norm(payload.email) ?? undefined;
    const phone = norm(payload.phone) ?? undefined;
    const full_name = norm(payload.full_name) ?? undefined;

    const password = crypto.randomBytes(10).toString('hex');
    const {data, error} = await api.createUser({
        email,
        phone,
        password,
        email_confirm: !!email,
        phone_confirm: !!phone,
        user_metadata: {full_name, phone},
    });
    if (error) throw new Error(error.message);
    if (!data?.user?.id) throw new Error('createUser: no user id');
    return data.user.id;
}

// Создать/найти владельца
async function upsertOwnerUser(admin: AdminClient, payload: Body): Promise<string> {
    const email = norm(payload.email) ?? undefined;
    const phone = norm(payload.phone) ?? undefined;
    const full_name = norm(payload.full_name) ?? undefined;
    if (!email && !phone) throw new Error('Укажите email или телефон владельца');

    try {
        return await createUser(admin, {email, phone, full_name});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/already/i.test(msg)) {
            const id = await findUserIdByEmailOrPhone(admin, email, phone);
            if (!id) throw new Error('Пользователь существует, но id не найден');
            return id;
        }
        throw e;
    }
}

export async function POST(req: Request, context: unknown) {
    try {
        const bizId = await getRouteParamRequired(context, 'id');
        
        // env & auth
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});
        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        const admin: AdminClient = createClient(URL, SERVICE);
        const body = (await req.json()) as Body;

        // найдём/создадим нового владельца
        const newOwnerId = await upsertOwnerUser(admin, body);

        // берём текущего владельца
        const {data: biz, error: eBiz} = await admin
            .from('businesses')
            .select('owner_id')
            .eq('id', bizId)
            .maybeSingle();
        if (eBiz) return NextResponse.json({ok: false, error: eBiz.message}, {status: 400});

        const prevOwnerId = (biz?.owner_id as string | null) ?? null;

        // 1) проставить нового владельца
        const {error: eUpd} = await admin.from('businesses').update({owner_id: newOwnerId}).eq('id', bizId);
        if (eUpd) return NextResponse.json({ok: false, error: eUpd.message}, {status: 400});

        // 2) роль owner новому
        const roleNew: UserRoleInsert = {user_id: newOwnerId, biz_id: bizId, role: 'owner'};
        const {error: eRoleNew} = await admin
            .from('user_roles')
            .upsert(roleNew, {onConflict: 'biz_id,user_id,role'});
        if (eRoleNew) return NextResponse.json({ok: false, error: eRoleNew.message}, {status: 400});

        // 3) снять owner со старого (если был и это другой)
        if (prevOwnerId && prevOwnerId !== newOwnerId) {
            const {error: eRoleDel} = await admin
                .from('user_roles')
                .delete()
                .eq('biz_id', bizId)
                .eq('role', 'owner')
                .eq('user_id', prevOwnerId);
            if (eRoleDel) return NextResponse.json({ok: false, error: eRoleDel.message}, {status: 400});
        }

        return NextResponse.json({
            ok: true,
            owner_id: newOwnerId,
            replaced: Boolean(prevOwnerId && prevOwnerId !== newOwnerId),
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('owner set error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
