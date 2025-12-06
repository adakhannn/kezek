// kezek/apps/web/src/app/_components/AuthStatusServer.tsx
// Серверный статус авторизации с роутингом по ролям
import { createServerClient } from '@supabase/ssr';
import { unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { SignOutButton } from './SignOutButton';

export const dynamic = 'force-dynamic';

async function getTargetPath(supabase: ReturnType<typeof createServerClient>, userId?: string | null) {
    // super admin?
    const { data: isSuperData } = await supabase.rpc('is_super_admin');
    if (isSuperData) return { href: '/admin', label: 'Админ-панель' };

    // владеет хоть одним бизнесом?
    if (userId) {
        const { count } = await supabase
            .from('businesses')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', userId);
        if ((count ?? 0) > 0) return { href: '/dashboard', label: 'Кабинет владельца' };
    }

    // роли пользователя (перестрахуемся на случай делегированных ролей)
    const { data: roleKeys } = await supabase.rpc('my_role_keys');
    const roles = Array.isArray(roleKeys) ? (roleKeys as string[]) : [];
    if (roles.some((r) => ['owner', 'admin', 'manager'].includes(r))) {
        return { href: '/dashboard', label: 'Кабинет бизнеса' };
    }

    // по умолчанию — личный кабинет клиента
    return { href: '/cabinet', label: 'Мои записи' };
}

export async function AuthStatusServer() {
    noStore();

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                // ❗️В RSC только чтение: без set/remove
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;

    if (!user) {
        return (
            <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-600">Вы не авторизованы</span>
                <Link href="/auth/sign-in" className="border rounded px-3 py-1">
                    Войти
                </Link>
            </div>
        );
    }

    const label = user.email ?? (user.phone as string | undefined) ?? 'аккаунт';
    const target = await getTargetPath(supabase, user.id);

    return (
        <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-600">
        Вы вошли как <b>{label}</b>
      </span>
            <Link href={target.href} className="border rounded px-3 py-1">
                {target.label}
            </Link>
            <SignOutButton />
        </div>
    );
}
