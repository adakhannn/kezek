export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import {NextResponse} from 'next/server';

import { contactPhoneDigits, findAccountIdByConfirmedContact } from '@/lib/accountContactLookup';
import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import {sendEmailPassword} from '@/lib/senders/email';
import {sendSMS} from '@/lib/senders/sms';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

type Body = {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    role_key: 'owner' | 'manager' | 'staff' | 'admin' | 'client';
    sendTempPassword?: boolean;
};

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

export async function POST(req: Request, context: unknown) {
    try {
        const bizId = await getRouteParamRequired(context, 'id');
        

        // auth: только глобальный super_admin
        const supa = await createSupabaseServerClient();
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: roleErr} = await supa.rpc('is_super_admin');

        if (roleErr || !isSuper) {
            return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});
        }

        // body
        const raw = (await req.json()) as Body;
        const email = norm(raw.email);
        // One normalization for the lookup, the new account and the SMS (0555… becomes +996555…).
        const phoneDigits = contactPhoneDigits(norm(raw.phone));
        const phoneE164 = phoneDigits ? `+${phoneDigits}` : null;
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

        const admin = createSupabaseAdminClient();

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

        // Найти аккаунт, который подтвердил этот email или телефон, или создать новый (ARCH-03).
        // Неподтверждённые адреса и user_metadata.phone (его пишет сам пользователь) не в счёт:
        // иначе роль ушла бы тому, кто заранее вписал себе чужой контакт.
        let userId = await findAccountIdByConfirmedContact(admin, { email, phone: phoneDigits });
        let created_user = false;
        let tempPassword: string | null = null;

        if (!userId) {
            tempPassword = sendTemp ? generateTempPassword() : null;
            const provisional = tempPassword ?? crypto.randomBytes(8).toString('base64url');
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
                logError('AdminMembersAdd', 'createUser returned no id', { bizId });
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

        // Временный пароль — только аккаунту, созданному этим запросом. Пароль существующего
        // аккаунта не сбрасывается: это заперло бы владельца без его согласия (ARCH-03).
        let sent_temp_email = false;
        let sent_temp_sms = false;

        if (tempPassword) {
            if (email) {
                await sendEmailPassword({to: email, subject: 'Ваш временный пароль', tempPassword});
                sent_temp_email = true;
            }
            if (phoneE164) {
                await sendSMS({to: phoneE164, text: `Ваш временный пароль: ${tempPassword}`});
                sent_temp_sms = true;
            }
        }

        return NextResponse.json({
            ok: true,
            created_user,
            sent_temp_email,
            sent_temp_sms,
            ...(sendTemp && !created_user ? { temp_password_skipped: 'existing_account' } : {}),
        });
    } catch (e: unknown) {
        logError('AdminMembersAdd', 'Failed to add business member', e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
