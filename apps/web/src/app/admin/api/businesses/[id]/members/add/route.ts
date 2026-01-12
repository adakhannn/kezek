export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import {createServerClient} from '@supabase/ssr';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import { getRouteParamRequired } from '@/lib/routeParams';
import {sendEmailPassword} from '@/lib/senders/email';
import {sendSMS, normalizePhoneToE164} from '@/lib/senders/sms';

type Body = {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    role_key: 'owner' | 'manager' | 'staff' | 'admin' | 'client';
    sendTempPassword?: boolean;
};

type AdminClient = SupabaseClient;

const norm = (s?: string | null) => {
    const v = (s ?? '').trim();
    return v.length ? v : null;
};

function generateTempPassword(): string {
    const raw = crypto.randomBytes(16).toString('base64url').slice(0, 12);
    const needsUpper = !/[A-Z]/.test(raw);
    const needsLower = !/[a-z]/.test(raw);
    const needsDigit = !/[0-9]/.test(raw);
    const needsSpec = !/[^A-Za-z0-9]/.test(raw);
    let pwd = raw;
    if (needsUpper) pwd = 'A' + pwd.slice(1);
    if (needsLower) pwd = pwd.slice(0, 2) + 'a' + pwd.slice(3);
    if (needsDigit) pwd = pwd.slice(0, 3) + '7' + pwd.slice(4);
    if (needsSpec) pwd = pwd.slice(0, 4) + '!' + pwd.slice(5);
    return pwd;
}

async function findUserIdByEmailOrPhone(
    admin: AdminClient,
    email?: string | null,
    phone?: string | null
) {
    // listUsers нет параметров фильтра — листаем страницы и сравниваем вручную
    const api = admin.auth.admin as {
        listUsers: (args: { page?: number; perPage?: number }) => Promise<{
            data: {
                users: Array<{ id: string; email?: string | null; phone?: string | null; user_metadata?: unknown }>
            } | null;
            error: { message: string } | null;
        }>;
    };

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
        if (users.length < 1000) break;
    }
    return null;
}

export async function POST(req: Request, context: unknown) {
    try {
        const bizId = await getRouteParamRequired(context, 'id');
        
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // auth: только глобальный super_admin
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: superRow, error: roleErr} = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (roleErr || !superRow) {
            return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});
        }

        // body
        const raw = (await req.json()) as Body;
        const email = norm(raw.email);
        const phoneE164 = normalizePhoneToE164(norm(raw.phone));
        const full_name = norm(raw.full_name);
        const roleKey = raw.role_key;
        const sendTemp = !!raw.sendTempPassword;

        if (!email && !phoneE164) {
            return NextResponse.json({ok: false, error: 'Укажите email или телефон'}, {status: 400});
        }
        if (roleKey === ('super_admin' as unknown)) {
            return NextResponse.json({
                ok: false,
                error: 'Нельзя назначать super_admin в этом эндпойнте'
            }, {status: 400});
        }

        const admin = createClient(URL, SERVICE);

        // найдём role_id
        const {data: roleRow, error: eRole} = await admin
            .from('roles')
            .select('id')
            .eq('key', roleKey)
            .maybeSingle();

        if (eRole) return NextResponse.json({ok: false, error: eRole.message}, {status: 400});
        if (!roleRow?.id) {
            return NextResponse.json({ok: false, error: `Роль ${roleKey} не найдена`}, {status: 400});
        }
        const role_id = roleRow.id as string;

        // найти/создать пользователя
        let userId = await findUserIdByEmailOrPhone(admin, email, phoneE164);
        let created_user = false;

        if (!userId) {
            const provisional = sendTemp ? generateTempPassword() : crypto.randomBytes(8).toString('base64url');
            const {data, error} = await admin.auth.admin.createUser({
                email: email ?? undefined,
                phone: phoneE164 ?? undefined,
                password: provisional,
                email_confirm: false,
                phone_confirm: false,
                user_metadata: {full_name, phone: phoneE164 ?? undefined},
            });
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

            const createdId = data?.user?.id;
            if (!createdId) {
                return NextResponse.json({ok: false, error: 'createUser returned no id'}, {status: 500});
            }
            userId = createdId;
            created_user = true;
        } else if (full_name) {
            // обновим имя, если нашли существующего
            const {error: updErr} = await admin.auth.admin.updateUserById(userId, {
                user_metadata: {full_name},
            });
            if (updErr) {
                return NextResponse.json({ok: false, error: updErr.message}, {status: 400});
            }
        }

        // назначаем роль для бизнеса (idempotent)
        // Требуется уникальный индекс/constraint на (user_id, role_id, biz_id) с учетом NULL:
        //  - глобальные роли: UNIQUE(user_id, role_id) WHERE biz_id IS NULL
        //  - по бизнесу:     UNIQUE(user_id, role_id, biz_id) WHERE biz_id IS NOT NULL
        const {error: upsertErr} = await admin
            .from('user_roles')
            .upsert(
                {user_id: userId, role_id, biz_id: bizId},
                {onConflict: 'user_id,role_id,biz_id'}
            );

        if (upsertErr) {
            // дружелюбное описание, если нет нужного индекса/constraint
            const hint =
                /ON CONFLICT|unique|constraint/i.test(upsertErr.message)
                    ? `${upsertErr.message}. Проверь, что есть UNIQUE индексы:
  • CREATE UNIQUE INDEX user_roles_global_uniq ON public.user_roles (user_id, role_id) WHERE biz_id IS NULL;
  • CREATE UNIQUE INDEX user_roles_per_biz_uniq ON public.user_roles (user_id, role_id, biz_id) WHERE biz_id IS NOT NULL;`
                    : upsertErr.message;
            return NextResponse.json({ok: false, error: hint}, {status: 400});
        }

        // если попросили — выдаём временный пароль и шлём уведомления
        let sent_temp_email = false;
        let sent_temp_sms = false;

        if (sendTemp) {
            const temp = generateTempPassword();
            const {error: ePwd} = await admin.auth.admin.updateUserById(userId, {password: temp});
            if (ePwd) return NextResponse.json({ok: false, error: ePwd.message}, {status: 400});

            if (email) {
                await sendEmailPassword({to: email, subject: 'Ваш временный пароль', tempPassword: temp});
                sent_temp_email = true;
            }
            if (phoneE164) {
                await sendSMS({to: phoneE164, text: `Ваш временный пароль: ${temp}`});
                sent_temp_sms = true;
            }
        }

        return NextResponse.json({ok: true, created_user, sent_temp_email, sent_temp_sms});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
