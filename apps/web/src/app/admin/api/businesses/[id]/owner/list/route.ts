export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {logWarn} from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';

type OwnerInfo = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
};

export async function GET(req: Request, ctx: unknown) {
    try {
        const bizId = await getRouteParamRequired(ctx, 'id');

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // Кто вызывает — должен быть супер
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {},
            },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
        }

        const { data: superRow, error: superErr } = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (superErr) return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        if (!superRow) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        // Сервис-клиент
        const admin = createClient(URL, SERVICE);

        // Получаем role_id для роли 'owner'
        const { data: ownerRole, error: roleErr } = await admin
            .from('roles')
            .select('id')
            .eq('key', 'owner')
            .maybeSingle();

        if (roleErr || !ownerRole) {
            return NextResponse.json({ ok: false, error: 'Роль owner не найдена' }, { status: 400 });
        }

        // Получаем всех владельцев бизнеса
        const { data: ownerRoles, error: ownerRolesErr } = await admin
            .from('user_roles')
            .select('user_id')
            .eq('biz_id', bizId)
            .eq('role_id', ownerRole.id);

        if (ownerRolesErr) {
            return NextResponse.json({ ok: false, error: ownerRolesErr.message }, { status: 400 });
        }

        const ownerIds = (ownerRoles ?? []).map(r => r.user_id).filter(Boolean) as string[];

        if (ownerIds.length === 0) {
            return NextResponse.json({ ok: true, owners: [] });
        }

        // Получаем информацию о владельцах
        const owners: OwnerInfo[] = [];
        for (const ownerId of ownerIds) {
            try {
                const { data: userData, error: getUserErr } = await admin.auth.admin.getUserById(ownerId);
                if (getUserErr || !userData?.user) continue;

                const { data: profile } = await admin
                    .from('profiles')
                    .select('full_name')
                    .eq('id', ownerId)
                    .maybeSingle();

                owners.push({
                    id: ownerId,
                    email: userData.user.email ?? null,
                    phone: (userData.user as { phone?: string | null }).phone ?? null,
                    full_name: profile?.full_name ?? (userData.user.user_metadata?.full_name as string | undefined) ?? null,
                });
            } catch (e) {
                logWarn('OwnerList', `Failed to fetch owner ${ownerId}`, e);
            }
        }

        return NextResponse.json({ ok: true, owners });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

