// apps/web/src/app/admin/api/businesses/[id]/owner/save/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Body = { full_name?: string | null; email?: string | null; phone?: string | null };

function norm(v?: string | null) { const s = (v ?? '').trim(); return s || null; }
function isE164(s: string) { return /^\+[1-9]\d{1,14}$/.test(s); }

export async function POST(req: Request, context: unknown) {
    // безопасно достаём params.id без any
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};
    try {
        const biz_id = params?.id ?? '';
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // auth клиента (кто вызывает)
        const supa = createServerClient(URL, ANON, {
            cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });
        const { data: { user } } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });

        // доступ: super_admin или owner/admin этого бизнеса
        const { data: superRow } = await supa
            .from('user_roles_with_user')
            .select('user_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null).limit(1).maybeSingle();

        let allowed = !!superRow;
        if (!allowed) {
            const { data: isOwner } = await supa.rpc('has_role', { p_role: 'owner', p_biz_id: biz_id });
            const { data: isAdmin } = await supa.rpc('has_role', { p_role: 'admin', p_biz_id: biz_id });
            allowed = !!isOwner || !!isAdmin;
        }
        if (!allowed) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        const admin = createClient(URL, SERVICE);
        const body = (await req.json()) as Body;

        const full_name = norm(body.full_name);
        const email = norm(body.email);
        const phone = norm(body.phone);

        if (!email && !phone) {
            return NextResponse.json({ ok: false, error: 'Укажите email или телефон' }, { status: 400 });
        }
        if (phone && !isE164(phone)) {
            return NextResponse.json({ ok: false, error: 'Телефон в формате +996…' }, { status: 400 });
        }

        // найдём текущего владельца
        const { data: biz } = await admin.from('businesses')
            .select('owner_id').eq('id', biz_id).maybeSingle<{ owner_id: string | null }>();

        // найдём/создадим пользователя по email/телефону через вью с данными
        let targetUserId: string | null = null;

        if (email || phone) {
            const orParts: string[] = [];
            if (email) orParts.push(`email.eq.${email}`);
            if (phone) orParts.push(`phone.eq.${phone}`);
            const { data: found } = await admin
                .from('user_roles_with_user')
                .select('user_id,email,phone')
                .or(orParts.join(','))
                .limit(1);
            if (found && found.length) targetUserId = found[0].user_id as string;
        }

        // если не нашли — создаём
        if (!targetUserId) {
            const password = crypto.randomBytes(10).toString('hex');
            const { data: created, error: createErr } = await admin.auth.admin.createUser({
                email: email ?? undefined,
                phone: phone ?? undefined,
                password,
                email_confirm: !!email,
                phone_confirm: !!phone,
                user_metadata: { full_name: full_name ?? undefined },
            });
            if (createErr) {
                return NextResponse.json({ ok: false, error: createErr.message }, { status: 400 });
            }
            targetUserId = created!.user!.id;
            // продублировать имя в profiles
            if (full_name) {
                await admin.from('profiles').upsert({ id: targetUserId, full_name }, { onConflict: 'id' });
            }
        } else if (full_name) {
            // если нашли — обновим имя (профиль)
            await admin.from('profiles').upsert({ id: targetUserId, full_name }, { onConflict: 'id' });
        }

        // role_id для owner
        const { data: ownerRole, error: roleErr } = await admin
            .from('roles').select('id').eq('key', 'owner').maybeSingle<{ id: string }>();
        if (roleErr || !ownerRole) {
            return NextResponse.json({ ok: false, error: 'Роль owner не найдена' }, { status: 400 });
        }

        // снять owner с предыдущего (если был)
        if (biz?.owner_id && biz.owner_id !== targetUserId) {
            await admin.from('user_roles')
                .delete()
                .eq('user_id', biz.owner_id)
                .eq('role_id', ownerRole.id)
                .eq('biz_id', biz_id);
        }

        // назначить владельца в таблице businesses
        await admin.from('businesses').update({ owner_id: targetUserId }).eq('id', biz_id);

        // выдать роль owner через INSERT; дубль игнорируем по 23505
        const { error: insErr } = await admin.from('user_roles').insert({
            user_id: targetUserId,
            role_id: ownerRole.id,
            biz_id,
        });
        if (insErr && insErr.code !== '23505') {
            return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
        }

        let action: 'updated_current' | 'reassigned_existing' | 'reassigned_new' | 'assigned_existing' | 'created_and_assigned' = 'updated_current';
        if (!biz?.owner_id) {
            action = (email || phone) ? (targetUserId ? 'assigned_existing' : 'created_and_assigned') : 'created_and_assigned';
        } else if (biz.owner_id !== targetUserId) {
            action = email || phone ? 'reassigned_existing' : 'reassigned_new';
        }

        return NextResponse.json({ ok: true, action });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
