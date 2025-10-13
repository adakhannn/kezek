// apps/web/src/app/admin/api/businesses/[id]/owner/save/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import {createServerClient} from '@supabase/ssr';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';


// --- Типы для admin API (шим) ---
type AdminUser = {
    id: string;
    email?: string | null;
    phone?: string | null;
    user_metadata?: Record<string, unknown> | null;
};

type ListUsersArgs = { page?: number; perPage?: number };
type ListUsersResult = { data: { users: AdminUser[]; total?: number } | null; error: { message: string } | null };

type CreateUserArgs = {
    email?: string;
    phone?: string;
    password?: string;
    email_confirm?: boolean;
    phone_confirm?: boolean;
    user_metadata?: Record<string, unknown>;
};
type CreateUserResult = { data: { user: AdminUser } | null; error: { message: string } | null };

type UpdateUserAttrs = { email?: string; phone?: string; user_metadata?: Record<string, unknown> };
type UpdateUserResult = { data: { user: AdminUser } | null; error: { message: string } | null };

interface GoTrueAdminShim {
    listUsers(args: ListUsersArgs): Promise<ListUsersResult>;

    createUser(args: CreateUserArgs): Promise<CreateUserResult>;

    updateUserById(id: string, attrs: UpdateUserAttrs): Promise<UpdateUserResult>;
}

type AdminClient = SupabaseClient;

function getAdminAPI(client: AdminClient): GoTrueAdminShim {
    return (client as unknown as { auth: { admin: GoTrueAdminShim } }).auth.admin;
}

// --- Входное тело ---
type Body = {
    full_name?: string | null;
    email?: string | null; // e-mail владельца
    phone?: string | null; // E.164 (+996…)
};

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

// Поиск существующего пользователя по email/phone через Admin API (странично)
async function findUserIdByEmailOrPhone(admin: AdminClient, email?: string | null, phone?: string | null) {
    const api = getAdminAPI(admin);
    const emailLc = email?.toLowerCase();
    const phoneNorm = phone ?? undefined;

    for (let page = 1; page <= 10; page++) {
        const {data, error} = await api.listUsers({page, perPage: 1000});
        if (error) throw new Error(error.message);

        const users = data?.users ?? [];
        const found = users.find((u) => {
            const byEmail = emailLc && (u.email ?? '').toLowerCase() === emailLc;
            const metaPhone = (u.user_metadata && (u.user_metadata as Record<string, unknown>).phone) as string | undefined;
            const byPhone = phoneNorm && (u.phone === phoneNorm || metaPhone === phoneNorm);
            return Boolean(byEmail || byPhone);
        });

        if (found) return found.id;
        if (users.length < 1000) break; // последняя страница
    }
    return null;
}

async function createUser(admin: AdminClient, payload: Body): Promise<string> {
    const api = getAdminAPI(admin);
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
    if (!data?.user?.id) throw new Error('createUser: user id is missing');
    return data.user.id;
}

export async function POST(req: Request, context: unknown) {
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};
    try {
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

        const admin = createClient(URL, SERVICE);
        const bizId = params.id;
        const body = (await req.json()) as Body;

        // входные
        const newEmail = norm(body.email);
        const newPhone = norm(body.phone);
        const newFullName = norm(body.full_name);

        if (!newEmail && !newPhone && !newFullName) {
            return NextResponse.json({ok: true, action: 'noop'});
        }

        // текущий бизнес и владелец
        const {data: biz, error: eBiz} = await admin
            .from('businesses')
            .select('owner_id')
            .eq('id', bizId)
            .maybeSingle();
        if (eBiz) return NextResponse.json({ok: false, error: eBiz.message}, {status: 400});

        const currentOwnerId = (biz?.owner_id as string | null) ?? null;

        // Подбор существующего пользователя по новым контактам
        let matchedUserId: string | null = null;
        if (newEmail || newPhone) {
            matchedUserId = await findUserIdByEmailOrPhone(admin, newEmail, newPhone);
        }

        const api = getAdminAPI(admin);

        // ====== СЦЕНАРИИ ======
        if (currentOwnerId) {
            if (!newEmail && !newPhone) {
                // только имя
                const {error: eUpd} = await api.updateUserById(currentOwnerId, {
                    user_metadata: {full_name: newFullName ?? ''},
                });
                if (eUpd) return NextResponse.json({ok: false, error: eUpd.message}, {status: 400});
                return NextResponse.json({ok: true, action: 'updated_name', owner_id: currentOwnerId});
            }

            if (matchedUserId && matchedUserId !== currentOwnerId) {
                // ПЕРЕНАЗНАЧЕНИЕ на существующего пользователя
                const {error: eBizUpd} = await admin.from('businesses').update({owner_id: matchedUserId}).eq('id', bizId);
                if (eBizUpd) return NextResponse.json({ok: false, error: eBizUpd.message}, {status: 400});

                // Новому — роль owner
                const roleNew = {user_id: matchedUserId, biz_id: bizId, role: 'owner' as const};
                const {error: eGive} = await admin.from('user_roles').upsert(roleNew, {onConflict: 'biz_id,user_id,role'});
                if (eGive) return NextResponse.json({ok: false, error: eGive.message}, {status: 400});

                // Старому — роль client, и убрать owner
                const roleClient = {user_id: currentOwnerId, biz_id: bizId, role: 'client' as const};
                const {error: eClient} = await admin.from('user_roles').upsert(roleClient, {onConflict: 'biz_id,user_id,role'});
                if (eClient) return NextResponse.json({ok: false, error: eClient.message}, {status: 400});

                const {error: eRemove} = await admin
                    .from('user_roles')
                    .delete()
                    .eq('biz_id', bizId)
                    .eq('role', 'owner')
                    .eq('user_id', currentOwnerId);
                if (eRemove) return NextResponse.json({ok: false, error: eRemove.message}, {status: 400});

                return NextResponse.json({ok: true, action: 'reassigned_existing', owner_id: matchedUserId});
            }

            if (!matchedUserId && (newEmail || newPhone)) {
                // Пытаемся обновить контакты текущего владельца
                const updatePayload: UpdateUserAttrs = {};
                if (newEmail) updatePayload.email = newEmail;
                if (newPhone) updatePayload.phone = newPhone;
                if (newFullName !== null) updatePayload.user_metadata = {full_name: newFullName ?? ''};

                const {error: eUpd} = await api.updateUserById(currentOwnerId, updatePayload);
                if (!eUpd) {
                    return NextResponse.json({ok: true, action: 'updated_current', owner_id: currentOwnerId});
                }

                // Если коллизия — создаём нового и ПЕРЕНАЗНАЧАЕМ (старому -> client)
                if (/already|registered|exists/i.test(eUpd.message)) {
                    const newUserId = await createUser(admin, {
                        email: newEmail,
                        phone: newPhone,
                        full_name: newFullName ?? undefined,
                    });

                    const {error: eBizUpd} = await admin.from('businesses').update({owner_id: newUserId}).eq('id', bizId);
                    if (eBizUpd) return NextResponse.json({ok: false, error: eBizUpd.message}, {status: 400});

                    const roleNew = {user_id: newUserId, biz_id: bizId, role: 'owner' as const};
                    const {error: eGive} = await admin.from('user_roles').upsert(roleNew, {onConflict: 'biz_id,user_id,role'});
                    if (eGive) return NextResponse.json({ok: false, error: eGive.message}, {status: 400});

                    const roleClient = {user_id: currentOwnerId, biz_id: bizId, role: 'client' as const};
                    const {error: eClient} = await admin.from('user_roles').upsert(roleClient, {onConflict: 'biz_id,user_id,role'});
                    if (eClient) return NextResponse.json({ok: false, error: eClient.message}, {status: 400});

                    const {error: eRemove} = await admin
                        .from('user_roles')
                        .delete()
                        .eq('biz_id', bizId)
                        .eq('role', 'owner')
                        .eq('user_id', currentOwnerId);
                    if (eRemove) return NextResponse.json({ok: false, error: eRemove.message}, {status: 400});

                    return NextResponse.json({ok: true, action: 'reassigned_new', owner_id: newUserId});
                }

                return NextResponse.json({ok: false, error: eUpd.message}, {status: 400});
            }

            // matchedUserId === currentOwnerId → просто апдейт текущего
            const {error: eUpd} = await api.updateUserById(currentOwnerId, {
                ...(newEmail ? {email: newEmail} : {}),
                ...(newPhone ? {phone: newPhone} : {}),
                ...(newFullName !== null ? {user_metadata: {full_name: newFullName ?? ''}} : {}),
            });
            if (eUpd) return NextResponse.json({ok: false, error: eUpd.message}, {status: 400});
            return NextResponse.json({ok: true, action: 'updated_current', owner_id: currentOwnerId});
        }

        // ВЛАДЕЛЬЦА НЕТ — назначаем
        let ownerId: string;
        if (matchedUserId) {
            ownerId = matchedUserId;
            if (newFullName !== null) {
                const {error: eUpdName} = await getAdminAPI(admin).updateUserById(ownerId, {
                    user_metadata: {full_name: newFullName ?? ''},
                });
                if (eUpdName) return NextResponse.json({ok: false, error: eUpdName.message}, {status: 400});
            }
        } else {
            ownerId = await createUser(admin, {
                email: newEmail,
                phone: newPhone,
                full_name: newFullName ?? undefined,
            });
        }

        const {error: eBizUpd} = await admin.from('businesses').update({owner_id: ownerId}).eq('id', bizId);
        if (eBizUpd) return NextResponse.json({ok: false, error: eBizUpd.message}, {status: 400});

        const roleOwner = {user_id: ownerId, biz_id: bizId, role: 'owner' as const};
        const {error: eRole} = await admin.from('user_roles').upsert(roleOwner, {onConflict: 'biz_id,user_id,role'});
        if (eRole) return NextResponse.json({ok: false, error: eRole.message}, {status: 400});

        return NextResponse.json({
            ok: true,
            action: matchedUserId ? 'assigned_existing' : 'created_and_assigned',
            owner_id: ownerId,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('owner save error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
