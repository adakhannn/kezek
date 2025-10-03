export const runtime = 'nodejs';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Payload = {
    name: string;
    slug: string;
    address: string | null;
    phones: string[];
    tz: string;
    categories: string[];
    email_notify_to: string[];
    owner?: { email: string | null; phone: string | null; full_name: string | null } | null;
};

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Payload;

        const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();
        const ssr = createServerClient(url, anon, {
            cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        // проверяем супер-админа
        const { data: isSuper, error: eSuper } = await ssr.rpc('is_super_admin');
        if (eSuper || !isSuper) {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        // вставка бизнеса
        const { data: inserted, error: eIns } = await ssr
            .from('businesses')
            .insert({
                name: body.name,
                slug: body.slug,
                address: body.address,
                phones: body.phones,
                tz: body.tz,
                categories: body.categories,
                email_notify_to: body.email_notify_to,
                is_approved: true,
                plan: 'pro',
            })
            .select('id')
            .maybeSingle();

        if (eIns || !inserted?.id) {
            return NextResponse.json({ error: eIns?.message || 'insert_failed' }, { status: 400 });
        }

        const bizId = inserted.id as string;

        // если указан владелец — создадим/найдём пользователя и дадим роль owner
        if (body.owner && (body.owner.email || body.owner.phone)) {
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE!;
            const admin = createClient(url, serviceKey); // admin SDK

            // попробуем найти по email/phone
            let ownerId: string | null = null;

            // auth.users недоступна напрямую, воспользуемся нашим view
            const findBy = body.owner.phone || body.owner.email;
            if (findBy) {
                const { data: existing } = await ssr
                    .from('auth_users_view')
                    .select('id,email,phone')
                    .or([
                        body.owner.email ? `email.eq.${body.owner.email}` : 'email.is.null',
                        body.owner.phone ? `,phone.eq.${body.owner.phone}` : '',
                    ].join(''))
                    .limit(1)
                    .maybeSingle();

                if (existing?.id) ownerId = existing.id as string;
            }

            if (!ownerId) {
                const { data: created, error: eCreate } = await admin.auth.admin.createUser({
                    email: body.owner.email || undefined,
                    phone: body.owner.phone || undefined,
                    user_metadata: { full_name: body.owner.full_name ?? null },
                    email_confirm: !!body.owner.email,
                    phone_confirm: !!body.owner.phone,
                });
                if (eCreate || !created?.user?.id) {
                    return NextResponse.json({ error: eCreate?.message || 'owner_create_failed' }, { status: 400 });
                }
                ownerId = created.user.id;
            }

            // проставим owner_id в businesses и роль в user_roles
            await ssr.from('businesses').update({ owner_id: ownerId }).eq('id', bizId);
            await ssr.from('user_roles').upsert({ user_id: ownerId, biz_id: bizId, role: 'owner' }, { onConflict: 'user_id,biz_id' });
        }

        return NextResponse.json({ id: bizId });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
}
