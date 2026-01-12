// apps/web/src/app/admin/api/businesses/[id]/members/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import { getRouteParamRequired } from '@/lib/routeParams';
import { isUuid } from '@/lib/validation';

type Item = {
    user_id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
    roles: string[]; // на клиенте скастится к RoleKey[]
};

export async function GET(_req: Request, context: unknown) {
    try {
        const id = await getRouteParamRequired(context, 'id');
        
        if (!isUuid(id)) {
            return NextResponse.json({ok: false, error: 'bad biz_id'}, {status: 400});
        }

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        // 1) Пытаемся получить через RPC (быстрее и безопаснее)
        const {data: rpcData, error: rpcErr} = await supa.rpc('members_of_biz', {p_biz_id: id});

        if (!rpcErr && Array.isArray(rpcData)) {
            // нормализуем (типизируем)
            const items: Item[] = rpcData.map((r) => ({
                user_id: String(r.user_id),
                email: r.email ?? null,
                phone: r.phone ?? null,
                full_name: r.full_name ?? null,
                roles: Array.isArray(r.roles) ? r.roles.map(String) : [],
            }));
            return NextResponse.json({ok: true, items});
        }

        // 2) Фолбэк: собираем вручную из view user_roles_with_user (как у тебя)
        const {data: rows, error} = await supa
            .from('user_roles_with_user')
            .select('user_id,email,phone,full_name,role_key,biz_id')
            .eq('biz_id', id);

        if (error) {
            // если в RLS отказ — вернём 403, иначе 400
            const code = /P0001|denied|forbidden/i.test(error.message) ? 403 : 400;
            return NextResponse.json({ok: false, error: error.message}, {status: code});
        }

        const map = new Map<string, Item>();
        for (const r of rows ?? []) {
            const uid = String(r.user_id);
            if (!map.has(uid)) {
                map.set(uid, {
                    user_id: uid,
                    email: (r).email ?? null,
                    phone: (r).phone ?? null,
                    full_name: (r).full_name ?? null,
                    roles: [],
                });
            }
            const role = (r).role_key ? String((r).role_key) : '';
            if (role && !map.get(uid)!.roles.includes(role)) map.get(uid)!.roles.push(role);
        }

        const items = Array.from(map.values());
        return NextResponse.json({ok: true, items});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
