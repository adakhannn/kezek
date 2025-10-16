import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    // 1) авторизация
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/sign-in?redirect=/admin');

    // 2) проверка роли super_admin глобально (biz_id IS NULL)
    const { data: superRow, error: roleErr } = await supabase
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    const isSuper = !!superRow;

    if (roleErr || !isSuper) {
        return (
            <main className="p-6">
                <h1 className="text-xl font-semibold">403</h1>
                <p className="text-gray-600">Нет доступа (нужен супер-админ)</p>
            </main>
        );
    }

    return (
        <div className="mx-auto max-w-6xl p-6 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Админка</h1>
                <nav className="flex gap-3 text-sm">
                    <Link className="border px-3 py-1 rounded" href="/admin">Главная</Link>
                    <Link className="border px-3 py-1 rounded" href="/admin/businesses">Бизнесы</Link>
                    <Link className="border px-3 py-1 rounded" href="/admin/categories">Категории</Link>
                    <Link className="border px-3 py-1 rounded" href="/admin/users">Пользователи</Link>
                    <Link className="border px-3 py-1 rounded" href="/admin/roles">Роли</Link>
                    <Link className="border px-3 py-1 rounded" href="/">На сайт</Link>
                </nav>
            </header>
            {children}
        </div>
    );
}
