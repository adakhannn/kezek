// apps/web/src/app/admin/api/users/[id]/roles/add/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Role = 'owner' | 'manager' | 'staff' | 'admin' | 'client';
type Body = { biz_id: string; role: Role };

type BizRow = { id: string };
type UserRolesRow = { user_id: string; biz_id: string; role: Role };

export async function POST(req: Request, {params}: { params: { id: string } }) {
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        // --- parse & validate body
        const parsed = (await req.json()) as Partial<Body> | null;
        const bizId = parsed?.biz_id?.trim();
        const role = parsed?.role;
        const ROLES: Role[] = ['owner', 'manager', 'staff', 'admin', 'client'];

        if (!bizId || !role || !ROLES.includes(role)) {
            return NextResponse.json(
                {ok: false, error: 'Bad request: provide valid biz_id and role'},
                {status: 400},
            );
        }

        // --- auth: only super admin
        const cookieStore = await cookies();
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });
        const {
            data: {user},
        } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // --- admin client
        const admin = createClient(URL, SERVICE);

        // sanity checks: бизнес существует?
        const {data: biz, error: eBiz} = await admin
            .from('businesses')
            .select('id')
            .eq('id', bizId)
            .maybeSingle<BizRow>();
        if (eBiz) return NextResponse.json({ok: false, error: eBiz.message}, {status: 400});
        if (!biz) return NextResponse.json({ok: false, error: 'Бизнес не найден'}, {status: 404});

        // sanity checks: пользователь существует?
        const {data: gotUser, error: eGetUser} = await admin.auth.admin.getUserById(params.id);
        if (eGetUser) return NextResponse.json({ok: false, error: eGetUser.message}, {status: 400});
        if (!gotUser?.user) {
            return NextResponse.json({ok: false, error: 'Пользователь не найден'}, {status: 404});
        }

        // owner — только через страницу владельца (чтобы не сделать 2 владельца).
        if (role === 'owner') {
            // Есть ли уже владелец (отличный от текущего)?
            const {count, error: eCnt} = await admin
                .from('user_roles')
                .select('user_id', {head: true, count: 'exact'})
                .eq('biz_id', bizId)
                .eq('role', 'owner')
                .neq('user_id', params.id);
            if (eCnt) return NextResponse.json({ok: false, error: eCnt.message}, {status: 400});

            if ((count ?? 0) > 0) {
                return NextResponse.json(
                    {
                        ok: false,
                        error:
                            'У бизнеса уже есть владелец. Поменять владельца можно на странице «Владелец» карточки бизнеса.',
                    },
                    {status: 409},
                );
            }
            // если текущий уже владелец — просто сделаем идемпотентный upsert ниже
        }

        // upsert роли
        const {error: eUp} = await admin
            .from('user_roles')
            .upsert(
                {user_id: params.id, biz_id: bizId, role} satisfies UserRolesRow,
                {onConflict: 'biz_id,user_id,role'},
            );
        if (eUp) return NextResponse.json({ok: false, error: eUp.message}, {status: 400});

        return NextResponse.json({ok: true});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('role add error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
