// apps/web/src/app/admin/api/users/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient, type User} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Item = {
    id: string;
    email: string;
    phone: string;
    created_at: string | null;
    last_sign_in_at: string | null;
    full_name: string;
    is_super: boolean;
};

type ProfilesRow = { id: string; full_name: string | null };
type SuperAdminRow = { user_id: string };

export async function GET(req: Request) {
    try {
        // ВАЖНО: не переименовывать глобальный класс URL!
        const urlObj = new globalThis.URL(req.url);
        const searchParams = urlObj.searchParams;

        const page = Number(searchParams.get('page') ?? '1'); // 1-based
        const perPage = Math.min(Number(searchParams.get('perPage') ?? '50'), 200);
        const q = (searchParams.get('q') ?? '').trim().toLowerCase();

        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        const cookieStore = await cookies();
        const supa = createServerClient(SUPABASE_URL, ANON_KEY, {
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

        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

        // Админ-список пользователей
        const {data: list, error} = await admin.auth.admin.listUsers({page, perPage});
        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        const users: User[] = list?.users ?? [];

        // Подмешаем full_name из profiles
        const ids = users.map((u) => u.id);
        const fullNames: Record<string, string> = {};
        if (ids.length) {
            const {data: profs} = await admin
                .from('profiles')
                .select('id,full_name')
                .in('id', ids)
                .returns<ProfilesRow[]>();
            (profs ?? []).forEach((p) => {
                fullNames[p.id] = p.full_name ?? '';
            });
        }

        // кто super_admin
        const superSet = new Set<string>();
        if (ids.length) {
            const {data: supers} = await admin
                .from('super_admins')
                .select('user_id')
                .in('user_id', ids)
                .returns<SuperAdminRow[]>();
            (supers ?? []).forEach((r) => superSet.add(r.user_id));
        }

        let items: Item[] = users.map((u): Item => {
            const meta = (u.user_metadata ?? {}) as Partial<{ full_name: string }>;
            return {
                id: u.id,
                email: u.email ?? '',
                phone: (u as { phone?: string | null }).phone ?? '',
                created_at: (u as { created_at?: string | null }).created_at ?? null,
                last_sign_in_at: (u as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
                full_name: fullNames[u.id] ?? meta.full_name ?? '',
                is_super: superSet.has(u.id),
            };
        });

        // локальный поиск по текущей странице
        if (q) {
            const ql = q.toLowerCase();
            items = items.filter(
                (it) =>
                    it.email.toLowerCase().includes(ql) ||
                    it.phone.toLowerCase().includes(ql) ||
                    it.full_name.toLowerCase().includes(ql) ||
                    it.id.toLowerCase().includes(ql),
            );
        }

        return NextResponse.json({
            ok: true,
            page,
            perPage,
            total: (list as { total?: number } | undefined)?.total,
            items,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('users list error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
