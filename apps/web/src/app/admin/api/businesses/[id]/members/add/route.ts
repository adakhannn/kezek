export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import {createServerClient} from '@supabase/ssr';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import {sendEmailPassword} from '@/lib/senders/email';
import {sendSMS, normalizePhoneToE164} from '@/lib/senders/sms';

type Body = {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    role_key: 'owner' | 'manager' | 'staff' | 'admin' | 'client';
    sendTempPassword?: boolean;     // ← если true — задаём/шлём временный пароль (email/SMS)
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

async function findUserIdByEmailOrPhone(admin: AdminClient, email?: string | null, phone?: string | null) {
    const api = (admin).auth.admin as {
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

export async function POST(req: Request, context: { params: { bizId: string } }) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // Авторизация: глобальный super_admin
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {
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

        // Входные данные
        const body = (await req.json()) as Body;
        const {bizId} = context.params;

        const email = norm(body.email);
        const phoneE164 = normalizePhoneToE164(norm(body.phone));
        const full_name = norm(body.full_name);
        const roleKey = body.role_key;
        const sendTemp = !!body.sendTempPassword;

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

        // Роль → role_id
        const {data: roleRow, error: eRole} = await admin
            .from('roles')
            .select('id')
            .eq('key', roleKey)
            .maybeSingle();
        if (eRole || !roleRow) {
            return NextResponse.json({ok: false, error: `Роль ${roleKey} не найдена`}, {status: 400});
        }
        const role_id = roleRow.id as string;

        // Находим/создаём пользователя
        let userId = await findUserIdByEmailOrPhone(admin, email, phoneE164);
        let created_user = false;

        if (!userId) {
            const provisional = sendTemp ? generateTempPassword() : crypto.randomBytes(8).toString('base64url');
            const {data, error} = await (admin).auth.admin.createUser({
                email: email ?? undefined,
                phone: phoneE164 ?? undefined,
                password: provisional,
                email_confirm: false,
                phone_confirm: false,
                user_metadata: {full_name, phone: phoneE164 ?? undefined},
            });
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
            userId = data?.user?.id!;
            created_user = true;
        } else if (full_name) {
            await (admin).auth.admin.updateUserById(userId, {
                user_metadata: {full_name},
            });
        }

        // Назначаем бизнес-роль (idempotent)
        // Было: onConflict: 'user_id,role_id,biz_id'
        const {error} = await admin
            .from('user_roles')
            .upsert(
                {user_id: userId, role_id, biz_id: bizId},           // biz_id как раньше
                {onConflict: 'user_id,role_id,biz_key'}      // ВАЖНО: biz_key
            );

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        // Временный пароль + рассылка (email/SMS)
        let sent_temp_email = false;
        let sent_temp_sms = false;

        if (sendTemp) {
            const temp = generateTempPassword();
            const {error: ePwd} = await (admin).auth.admin.updateUserById(userId, {password: temp});
            if (ePwd) return NextResponse.json({ok: false, error: ePwd.message}, {status: 400});

            // email
            if (email) {
                await sendEmailPassword({to: email, subject: 'Ваш временный пароль', tempPassword: temp});
                sent_temp_email = true;
            }
            // sms
            if (phoneE164) {
                const text = `Ваш временный пароль: ${temp}`;
                await sendSMS({to: phoneE164, text});
                sent_temp_sms = true;
            }
        }

        return NextResponse.json({ok: true, created_user, sent_temp_email, sent_temp_sms});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
