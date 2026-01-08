// kezek/apps/web/src/app/_components/AuthStatusServer.tsx
// Серверный статус авторизации с роутингом по ролям
import { createServerClient } from '@supabase/ssr';
import { unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { PersonalCabinetButton } from './PersonalCabinetButton';
import { SignInButton } from './SignInButton';
import { SignOutButton } from './SignOutButton';

export const dynamic = 'force-dynamic';

async function getTargetPath(supabase: ReturnType<typeof createServerClient>, userId?: string | null) {
    if (!userId) return { href: '/cabinet', label: 'Мои записи' };

    // super admin?
    const { data: isSuperData } = await supabase.rpc('is_super_admin');
    if (isSuperData) return { href: '/admin', label: 'Админ-панель' };

    // владеет хоть одним бизнесом?
    const { count } = await supabase
        .from('businesses')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId);
    if ((count ?? 0) > 0) return { href: '/dashboard', label: 'Кабинет владельца' };

    // Проверяем наличие записи в staff (источник правды)
    const { data: staff } = await supabase
        .from('staff')
        .select('id, biz_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
    
    if (staff) {
        return { href: '/staff', label: 'Кабинет сотрудника' };
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
            <div className="hidden md:flex items-center gap-3">
                <SignInButton />
            </div>
        );
    }

    // Получаем имя из профиля
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
    
    const label = profile?.full_name?.trim() || user.email || (user.phone as string | undefined) || 'аккаунт';
    const target = await getTargetPath(supabase, user.id);
    
    // Проверяем, является ли пользователь сотрудником - ищем запись в staff (источник правды)
    let isStaff = false;
    try {
        const { data: staff } = await supabase
            .from('staff')
            .select('id, biz_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();
        
        isStaff = !!staff;
    } catch (error) {
        console.warn('AuthStatusServer: error checking staff record', error);
        // Fallback: проверяем через user_roles
        try {
            const [{ data: ur }, { data: roleRows }] = await Promise.all([
                supabase.from('user_roles').select('biz_id, role_id').eq('user_id', user.id),
                supabase.from('roles').select('id, key'),
            ]);
            
            if (ur && roleRows) {
                const rolesMap = new Map<string, string>(roleRows.map(r => [String(r.id), String(r.key)]));
                const staffRole = ur.find(r => rolesMap.get(String(r.role_id)) === 'staff');
                isStaff = !!staffRole?.biz_id;
            }
        } catch (fallbackError) {
            console.warn('AuthStatusServer: fallback check also failed', fallbackError);
        }
    }

    return (
        <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{label}</span>
                </span>
            </div>
            {isStaff && (
                <Link 
                    href="/staff" 
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                >
                    Кабинет сотрудника
                </Link>
            )}
            <PersonalCabinetButton />
            <SignOutButton />
        </div>
    );
}
