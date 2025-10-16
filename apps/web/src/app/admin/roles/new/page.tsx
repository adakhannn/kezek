// apps/web/src/app/admin/roles/new/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';

import RolesNewClient from './RolesNewClient';

export const dynamic = 'force-dynamic';

export default async function NewRolePage() {
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
        return (
            <main className="p-4 space-y-4">
                <h1 className="text-2xl font-semibold">Новая роль</h1>
                <div>Не авторизован</div>
            </main>
        );
    }

    // НОВАЯ проверка супер-админа (глобальная роль)
    const { data: superRow, error: roleErr } = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (roleErr || !superRow) {
        return <div className="p-4">Нет доступа</div>;
    }

    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const host = h.get('x-forwarded-host') ?? h.get('host')!;
    const baseURL = `${proto}://${host}`;

    return (
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Создать роль</h1>
                <Link href="/admin/roles" className="underline">← К списку ролей</Link>
            </div>
            <RolesNewClient baseURL={baseURL} />
        </main>
    );
}
