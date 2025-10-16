// apps/web/src/app/admin/roles/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';

import RolesClient from './RolesClient';

export const dynamic = 'force-dynamic';

export default async function RolesPage() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(url, anon, {
        cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
        return (
            <main className="p-4 space-y-4">
                <h1 className="text-2xl font-semibold">Роли</h1>
                <div>Не авторизован</div>
            </main>
        );
    }

    // НОВАЯ проверка супер-админа
    const { data: superRow, error: roleErr } = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (roleErr || !superRow) {
        return (
            <main className="p-4 space-y-4">
                <h1 className="text-2xl font-semibold">Роли</h1>
                <div>Нет доступа</div>
            </main>
        );
    }

    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const host  = h.get('x-forwarded-host') ?? h.get('host')!;
    const baseURL = `${proto}://${host}`;

    return (
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Роли</h1>
                <div className="flex gap-3 text-sm">
                    <Link href="/admin" className="underline">← В админку</Link>
                    <Link href="/admin/roles/new" className="border px-3 py-1.5 rounded hover:bg-gray-50">
                        + Новая роль
                    </Link>
                </div>
            </div>
            <RolesClient baseURL={baseURL} />
        </main>
    );
}
