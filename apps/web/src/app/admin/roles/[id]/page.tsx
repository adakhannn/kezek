import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import Link from 'next/link';

import EditRoleClient from './EditRoleClient';

export const dynamic = 'force-dynamic';

export default async function RoleEditPage({params}: { params: { id: string } }) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(url, anon, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value, set: () => {
            }, remove: () => {
            }
        },
    });

    const {data: {user}} = await supa.auth.getUser();
    if (!user) {
        return (
            <main className="p-4 space-y-4">
                <h1 className="text-2xl font-semibold">Роль</h1>
                <div>Не авторизован</div>
            </main>
        );
    }

    const {data: superRow, error: roleErr} = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (roleErr || !superRow) {
        return (
            <main className="p-4 space-y-4">
                <h1 className="text-2xl font-semibold">Роль</h1>
                <div>Нет доступа</div>
            </main>
        );
    }

    const {data: role, error} = await supa
        .from('roles')
        .select('id,key,name,description,is_system')
        .eq('id', params.id)
        .maybeSingle();

    if (error) {
        return <main className="p-4">Ошибка: {error.message}</main>;
    }
    if (!role) {
        return <main className="p-4">Роль не найдена</main>;
    }

    return (
        <main className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Редактировать роль</h1>
                <div className="flex gap-3 text-sm">
                    <Link href="/admin/roles" className="underline">← Назад к ролям</Link>
                </div>
            </div>

            <EditRoleClient role={role}/>
        </main>
    );
}
