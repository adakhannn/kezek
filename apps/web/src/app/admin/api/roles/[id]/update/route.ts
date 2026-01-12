// apps/web/src/app/admin/api/roles/[id]/update/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = { name?: string | null; description?: string | null };

const norm = (v?: string | null) => {
    const s = (v ?? '').trim();
    return s.length ? s : null;
};

export async function POST(req: Request, context: unknown) {
    try {
        // безопасно достаём id из контекста
        const params =
            typeof context === 'object' && context !== null && 'params' in context
                ? (context as { params?: Record<string, string | string[]> }).params ?? {}
                : {};
        const id = Array.isArray(params.id) ? params.id[0] : params.id;
        if (!id) {
            return NextResponse.json({ok: false, error: 'missing id'}, {status: 400});
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

        const {
            data: {user},
        } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        // проверка глобальной роли super_admin (biz_id IS NULL)
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

        const body = (await req.json()) as Body;

        // Собираем patch только из переданных полей
        const patch: Record<string, unknown> = {};
        if ('name' in body) {
            const v = norm(body.name);
            if (v === null) {
                // если пришла пустая строка — можно либо очистить, либо игнорировать;
                // выберем «очистить», чтобы админ мог убрать название.
                patch.name = null;
            } else {
                patch.name = v;
            }
        }
        if ('description' in body) {
            patch.description = norm(body.description); // null если пусто
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ok: true});
        }

        // key / is_system не меняем этим роутом
        const {error} = await supa.from('roles').update(patch).eq('id', id);

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

// На всякий — позволим PATCH/PUT той же логикой
export const PATCH = POST;
export const PUT = POST;
