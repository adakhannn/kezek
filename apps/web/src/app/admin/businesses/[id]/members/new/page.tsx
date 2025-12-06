import {createServerClient} from '@supabase/ssr';
import {cookies, headers} from 'next/headers';
import Link from 'next/link';

import NewMemberExisting from './NewMemberExisting';

import { isUuid } from '@/lib/validation';


export const dynamic = 'force-dynamic';

export default async function NewMemberPage(context: unknown) {
    // безопасно достаём params.id без any
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string> }).params
            : {};
    const {id} = params;
    if (!id || !isUuid(id)) {
        return <main className="p-4 text-red-600">Некорректный business id</main>;
    }

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: {
            get: n => cookieStore.get(n)?.value, set: () => {
            }, remove: () => {
            }
        },
    });

    const {data: {user}} = await supa.auth.getUser();
    if (!user) return <main className="p-4">Не авторизован</main>;

    // доступ: super_admin (global) ИЛИ owner/admin конкретного бизнеса
    const {data: superRow} = await supa
        .from('user_roles_with_user')
        .select('user_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    let allowed = !!superRow;
    if (!allowed) {
        const {data: isOwner} = await supa.rpc('has_role', {p_role: 'owner', p_biz_id: id});
        const {data: isAdmin} = await supa.rpc('has_role', {p_role: 'admin', p_biz_id: id});
        allowed = !!isOwner || !!isAdmin;
    }
    if (!allowed) return <main className="p-4">Нет доступа</main>;

    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const host = h.get('x-forwarded-host') ?? h.get('host')!;
    const baseURL = `${proto}://${host}`;

    return (
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Добавить участника из существующих</h1>
                <div className="flex gap-3 text-sm">
                    <Link href={`/admin/businesses/${id}/members`} className="underline">← К участникам</Link>
                </div>
            </div>
            <NewMemberExisting baseURL={baseURL} bizId={id}/>
        </main>
    );
}
