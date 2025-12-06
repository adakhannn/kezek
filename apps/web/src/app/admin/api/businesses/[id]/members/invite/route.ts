// apps/web/src/app/admin/api/businesses/[id]/members/invite/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { formatErrorSimple } from '@/lib/errors';
import { getRouteParamRequired } from '@/lib/routeParams';
import { sendEmailPassword } from '@/lib/senders/email';
import { sendSMS } from '@/lib/senders/sms';

type Body = {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    roles?: string[]; // ['owner'|'admin'|'manager'|'staff'|'client', ...]
};

type CreateUserPayload = {
    email?: string;
    phone?: string;
    password: string;
    email_confirm?: boolean;
    phone_confirm?: boolean;
    user_metadata?: { full_name?: string };
};

function norm(v?: string | null) { const s = (v ?? '').trim(); return s || null; }
function isUuid(v: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isE164(s: string) { return /^\+[1-9]\d{1,14}$/.test(s); }

export async function POST(req: Request, context: unknown) {
    try {
        const biz_id = await getRouteParamRequired(context, 'id');
        if (!isUuid(biz_id)) {
            return NextResponse.json({ ok: false, error: 'bad biz_id' }, { status: 400 });
        }

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // проверяем, что вызывающий авторизован и имеет доступ
        const supa = createServerClient(URL, ANON, {
            cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        // доступ: global super_admin ИЛИ owner/admin этого бизнеса
        const { data: superRow } = await supa
            .from('user_roles_with_user')
            .select('user_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        let allowed = !!superRow;
        if (!allowed) {
            const { data: isOwner } = await supa.rpc('has_role', { p_role: 'owner', p_biz_id: biz_id });
            const { data: isAdmin } = await supa.rpc('has_role', { p_role: 'admin', p_biz_id: biz_id });
            allowed = !!isOwner || !!isAdmin;
        }
        if (!allowed) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        const body = (await req.json()) as Body;
        const full_name = norm(body.full_name);
        const email = norm(body.email);
        const phone = norm(body.phone);
        const roles = Array.isArray(body.roles) ? body.roles.filter(Boolean) : [];

        if (!email && !phone) {
            return NextResponse.json({ ok: false, error: 'Нужен email или телефон' }, { status: 400 });
        }
        if (email && !isEmail(email)) {
            return NextResponse.json({ ok: false, error: 'Некорректный email' }, { status: 400 });
        }
        if (phone && !isE164(phone)) {
            return NextResponse.json({ ok: false, error: 'Телефон должен быть в формате E.164 (+996…)' }, { status: 400 });
        }

        const admin = createClient(URL, SERVICE);

        // получим id ролей одной пачкой
        const needKeys = Array.from(new Set(roles.length ? roles : ['client'])); // по умолчанию хотя бы client
        const { data: roleRows, error: roleErr } = await admin
            .from('roles')
            .select('id,key')
            .in('key', needKeys);
        if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 400 });

        const roleMap = new Map<string, string>(); // key -> id
        for (const r of roleRows ?? []) roleMap.set(r.key as string, r.id as string);

        // найдём пользователя по email/телефону через вью user_roles_with_user
        let userId: string | null = null;
        if (email || phone) {
            const orParts: string[] = [];
            if (email) orParts.push(`email.eq.${email}`);
            if (phone) orParts.push(`phone.eq.${phone}`);
            const { data: found, error: findErr } = await admin
                .from('user_roles_with_user')
                .select('user_id,email,phone')
                .or(orParts.join(','))
                .limit(1);
            if (findErr) return NextResponse.json({ ok: false, error: findErr.message }, { status: 400 });
            if (found && found.length) userId = found[0].user_id as string;
        }

        // если нет — создаём
        if (!userId) {
            const tempPassword = crypto.randomBytes(10).toString('hex');
            const createPayload: CreateUserPayload = {
                password: tempPassword,
                email_confirm: !!email,
                phone_confirm: !!phone,
            };
            if (email) createPayload.email = email;
            if (phone) createPayload.phone = phone;
            if (full_name) createPayload.user_metadata = { full_name };

            const { data: created, error: createErr } = await admin.auth.admin.createUser(createPayload);
            if (createErr || !created?.user) {
                return NextResponse.json({ ok: false, error: createErr?.message || 'createUser failed' }, { status: 400 });
            }
            userId = created.user.id;

            // дублируем имя в profiles
            if (full_name) {
                await admin.from('profiles').upsert({ id: userId, full_name }, { onConflict: 'id' });
            }

            // Отправка SMS/email с временным паролем
            try {
                if (phone) {
                    await sendSMS({ to: phone, text: `Ваш временный пароль для Kezek: ${tempPassword}. Рекомендуем сменить после первого входа.` });
                }
                if (email) {
                    await sendEmailPassword({ to: email, tempPassword, subject: 'Приглашение в Kezek — временный пароль' });
                }
            } catch (sendErr) {
                // Логируем ошибку отправки, но не прерываем процесс создания пользователя
                console.error('[invite] Failed to send temp password:', sendErr);
            }
        } else {
            // обновим имя, если прислали
            if (full_name) {
                await admin.from('profiles').upsert({ id: userId, full_name }, { onConflict: 'id' });
            }
        }

        // выдаём роли (insert; игнорируем дубль 23505)
        for (const key of needKeys) {
            const role_id = roleMap.get(key);
            if (!role_id) continue;
            const { error: insErr } = await admin.from('user_roles').insert({ user_id: userId, role_id, biz_id });
            if (insErr && insErr.code !== '23505') {
                return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ ok: false, error: formatErrorSimple(e) }, { status: 500 });
    }
}
