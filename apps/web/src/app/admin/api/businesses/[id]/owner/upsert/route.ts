// apps/web/src/app/admin/api/businesses/[id]/owner/upsert/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import {createServerClient} from '@supabase/ssr';
import {
    createClient,
    type SupabaseClient,
    type User,
    type AuthError,
} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';


// Админ-клиент без явных дженериков (избегаем TS2344/TS2589)
type AdminClient = SupabaseClient;

type Body = {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null; // E.164 (+996…)
};

type AdminAuthApi = {
    listUsers(args: { page?: number; perPage?: number }): Promise<{
        data: { users: User[] } | null;
        error: AuthError | null;
    }>;
    createUser(args: {
        email?: string;
        phone?: string;
        password: string;
        email_confirm?: boolean;
        phone_confirm?: boolean;
        user_metadata?: Record<string, unknown>;
    }): Promise<{ data: { user: User | null } | null; error: AuthError | null }>;
};

type UserRoleInsert = {
    user_id: string;
    biz_id: string;
    role: 'owner' | 'manager' | 'staff' | 'admin' | 'client';
};

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

// Поиск существующего пользователя по email/phone через Admin API (странично)
async function findUserIdByEmailOrPhone(
    admin: AdminClient,
    email?: string | null,
    phone?: string | null
): Promise<string | null> {
    const emailLc = email?.toLowerCase();
    const phoneNorm = phone ?? undefined;
    const adminAuth = (admin as { auth: { admin: AdminAuthApi } }).auth.admin;

    for (let page = 1; page <= 10; page++) {
        const {data, error} = await adminAuth.listUsers({page, perPage: 1000});
        if (error) throw error;

        const users = data?.users ?? [];
        const found = users.find((u) => {
            const byEmail = emailLc && u.email?.toLowerCase() === emailLc;
            const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
            const metaPhone =
                typeof meta.phone === 'string' ? (meta.phone as string) : undefined;
            const byPhone = phoneNorm && (u.phone === phoneNorm || metaPhone === phoneNorm);
            return Boolean(byEmail || byPhone);
        });

        if (found) return found.id;
        if (users.length < 1000) break; // последняя страница
    }
    return null;
}

// Создаёт пользователя или находит уже существующего; возвращает user_id
async function upsertOwnerUser(admin: AdminClient, payload: Body): Promise<string> {
    const email = norm(payload.email) ?? undefined;
    const phone = norm(payload.phone) ?? undefined;
    const full_name = norm(payload.full_name) ?? undefined;

    if (!email && !phone) throw new Error('Укажите email или телефон владельца');

    const adminAuth = (admin as { auth: { admin: AdminAuthApi } }).auth.admin;

    // Пытаемся создать нового пользователя
    const password = crypto.randomBytes(10).toString('hex');
    const {data, error} = await adminAuth.createUser({
        email,
        phone,
        password,
        email_confirm: !!email,
        phone_confirm: !!phone,
        user_metadata: {full_name, phone},
    });

    if (data?.user?.id) return data.user.id;

    // Если уже существует — ищем его id
    if (error && /already/i.test(error.message)) {
        const id = await findUserIdByEmailOrPhone(admin, email, phone);
        if (!id) throw new Error('Пользователь существует, но id не найден');
        return id;
    }

    throw error ?? new Error('createUser failed');
}

export async function POST(req: Request, context: unknown) {
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string> }).params
            : {};
    try {
        // ---- ENV guard ----
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!URL || !ANON || !SERVICE) {
            return NextResponse.json(
                {ok: false, error: 'ENV missing (URL/ANON/SERVICE)'},
                {status: 500}
            );
        }

        const body = (await req.json()) as Body;

        // ---- Проверка прав: только super_admin ----
        const cookieStore = await cookies();
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        const {
            data: {user},
        } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // ---- Сервис-клиент после проверки ----
        const admin: AdminClient = createClient(URL, SERVICE);

        // 1) Создаём/находим пользователя
        const ownerId = await upsertOwnerUser(admin, body);

        // 2) Проставляем owner_id у бизнеса
        const bizId = params.id;
        const {error: eUpd} = await admin.from('businesses').update({owner_id: ownerId}).eq('id', bizId);
        if (eUpd) return NextResponse.json({ok: false, error: eUpd.message}, {status: 400});

        // 3) Роль owner (idempotent upsert) — без any
        const roleRow: UserRoleInsert = {user_id: ownerId, biz_id: bizId, role: 'owner'};
        const {error: eRole} = await admin
            .from('user_roles')
            .upsert(roleRow, {onConflict: 'biz_id,user_id,role'});
        if (eRole) return NextResponse.json({ok: false, error: eRole.message}, {status: 400});

        return NextResponse.json({ok: true, owner_id: ownerId});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('owner upsert error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
