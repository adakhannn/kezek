import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';

import MembersClient from './MembersClient';

export const dynamic = 'force-dynamic';

function isUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export default async function MembersPage({ params }: { params: { id: string } }) {
    const { id } = params;

    if (!id || !isUuid(id)) {
        return (
            <main className="p-4">
                <div className="text-red-600">Некорректный business id</div>
            </main>
        );
    }

    const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    // 1) auth
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
        return <main className="p-4"><div>Не авторизован</div></main>;
    }

    // 2) доступ: super_admin (глобально) ИЛИ owner/admin этого бизнеса
    const { data: superRow } = await supa
        .from('user_roles_with_user')
        .select('user_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    let allowed = !!superRow;
    if (!allowed) {
        const { data: isOwner } = await supa.rpc('has_role', { p_role: 'owner', p_biz_id: id });
        const { data: isAdmin } = await supa.rpc('has_role', { p_role: 'admin', p_biz_id: id });
        allowed = !!isOwner || !!isAdmin;
    }
    if (!allowed) {
        return <main className="p-4"><div>Нет доступа</div></main>;
    }

    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const host  = h.get('x-forwarded-host') ?? h.get('host')!;
    const baseURL = `${proto}://${host}`;

    return (
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Участники бизнеса</h1>
                <div className="flex gap-3 text-sm">
                    <Link href={`/admin/businesses/${id}`} className="underline">← К бизнесу</Link>
                    <Link
                        href={`/admin/businesses/${id}/members/new`}
                        className="inline-flex items-center rounded border px-3 py-1.5 hover:bg-gray-50"
                    >
                        + Добавить участника
                    </Link>
                </div>
            </div>

            <MembersClient baseURL={baseURL} bizId={id} />
        </main>
    );
}
