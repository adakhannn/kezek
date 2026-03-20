export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getRouteParamUuid } from '@/lib/routeParams';
import { sendEmailPassword } from '@/lib/senders/email';
import { normalizePhoneToE164, sendSMS } from '@/lib/senders/sms';

type Body = {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    roles?: string[];
};

type CreateUserPayload = {
    email?: string;
    phone?: string;
    password: string;
    email_confirm?: boolean;
    phone_confirm?: boolean;
    user_metadata?: { full_name?: string; phone?: string };
};

const DEFAULT_ROLE = 'client';

function norm(value?: string | null) {
    const trimmed = (value ?? '').trim();
    return trimmed || null;
}

function isEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isE164(value: string) {
    return /^\+[1-9]\d{1,14}$/.test(value);
}

function generateTempPassword() {
    const raw = crypto.randomBytes(16).toString('base64url').slice(0, 12);
    let password = raw;

    if (!/[A-Z]/.test(password)) password = `A${password.slice(1)}`;
    if (!/[a-z]/.test(password)) password = `${password.slice(0, 2)}a${password.slice(3)}`;
    if (!/[0-9]/.test(password)) password = `${password.slice(0, 3)}7${password.slice(4)}`;
    if (!/[^A-Za-z0-9]/.test(password)) password = `${password.slice(0, 4)}!${password.slice(5)}`;

    return password;
}

export async function POST(req: Request, context: unknown) {
    try {
        const biz_id = await getRouteParamUuid(context, 'id');

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (name: string) => cookieStore.get(name)?.value,
                set: () => {},
                remove: () => {},
            },
        });

        const {
            data: { user },
        } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

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
        const phone = normalizePhoneToE164(norm(body.phone));
        const requestedRoles = Array.isArray(body.roles) ? body.roles.filter(Boolean) : [];

        if (!email && !phone) {
            return NextResponse.json({ ok: false, error: 'Нужен email или телефон' }, { status: 400 });
        }
        if (email && !isEmail(email)) {
            return NextResponse.json({ ok: false, error: 'Некорректный email' }, { status: 400 });
        }
        if (phone && !isE164(phone)) {
            return NextResponse.json({ ok: false, error: 'Телефон должен быть в формате E.164 (+996...)' }, { status: 400 });
        }

        const needKeys = Array.from(new Set((requestedRoles.length ? requestedRoles : [DEFAULT_ROLE]).filter((role) => role !== 'super_admin')));
        if (!needKeys.length) {
            return NextResponse.json({ ok: false, error: 'Не переданы допустимые роли' }, { status: 400 });
        }

        const admin = createClient(URL, SERVICE);

        const { data: roleRows, error: roleErr } = await admin
            .from('roles')
            .select('id,key')
            .in('key', needKeys);
        if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 400 });

        const roleMap = new Map<string, string>();
        for (const row of roleRows ?? []) roleMap.set(row.key as string, row.id as string);

        const missingRoles = needKeys.filter((role) => !roleMap.has(role));
        if (missingRoles.length) {
            return NextResponse.json({ ok: false, error: `Роли не найдены: ${missingRoles.join(', ')}` }, { status: 400 });
        }

        let userId: string | null = null;
        const orParts: string[] = [];
        if (email) orParts.push(`email.eq.${email}`);
        if (phone) orParts.push(`phone.eq.${phone}`);

        const { data: found, error: findErr } = await admin
            .from('user_roles_with_user')
            .select('user_id,email,phone')
            .or(orParts.join(','))
            .limit(1);
        if (findErr) return NextResponse.json({ ok: false, error: findErr.message }, { status: 400 });
        if (found?.length) userId = found[0].user_id as string;

        let created_user = false;
        let sent_temp_email = false;
        let sent_temp_sms = false;

        if (!userId) {
            const tempPassword = generateTempPassword();
            const createPayload: CreateUserPayload = {
                password: tempPassword,
                email_confirm: false,
                phone_confirm: false,
                user_metadata: {
                    full_name: full_name ?? undefined,
                    phone: phone ?? undefined,
                },
            };

            if (email) createPayload.email = email;
            if (phone) createPayload.phone = phone;

            const { data: created, error: createErr } = await admin.auth.admin.createUser(createPayload);
            if (createErr || !created?.user) {
                return NextResponse.json({ ok: false, error: createErr?.message || 'createUser failed' }, { status: 400 });
            }

            userId = created.user.id;
            created_user = true;

            if (full_name) {
                await admin.from('profiles').upsert({ id: userId, full_name }, { onConflict: 'id' });
            }

            if (email) {
                await sendEmailPassword({
                    to: email,
                    subject: 'Ваш временный пароль',
                    tempPassword,
                });
                sent_temp_email = true;
            }

            if (phone) {
                await sendSMS({
                    to: phone,
                    text: `Ваш временный пароль: ${tempPassword}`,
                });
                sent_temp_sms = true;
            }
        } else if (full_name) {
            await admin.from('profiles').upsert({ id: userId, full_name }, { onConflict: 'id' });
        }

        for (const key of needKeys) {
            const role_id = roleMap.get(key);
            if (!role_id) continue;

            const { error: insErr } = await admin.from('user_roles').insert({ user_id: userId, role_id, biz_id });
            if (insErr && insErr.code !== '23505') {
                return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
            }
        }

        return NextResponse.json({ ok: true, created_user, sent_temp_email, sent_temp_sms });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
