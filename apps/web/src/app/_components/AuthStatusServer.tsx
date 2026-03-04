// kezek/apps/web/src/app/_components/AuthStatusServer.tsx
// Серверный статус авторизации с роутингом по ролям
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';


import { PersonalCabinetButton } from './PersonalCabinetButton';
import { SignInButton } from './SignInButton';
import { SignOutButton } from './SignOutButton';
import { StaffCabinetButton } from './StaffCabinetButton';
import { getT } from './i18n/server';

import { getUserRoleProfile, resolveDefaultDashboard } from '@/lib/authContext';

export const dynamic = 'force-dynamic';

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

    const profile = await getUserRoleProfile(supabase as SupabaseClient);
    const t = await getT();

    // Имя/аккаунт в шапке
    const accountLabel =
        (await (async () => {
            const { data: profileRow } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle();
            return profileRow?.full_name?.trim();
        })()) ||
        user.email ||
        (user.phone as string | undefined) ||
        t('header.account', 'аккаунт');

    resolveDefaultDashboard(profile);

    const isStaff = !!profile?.canStaff;

    return (
        <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{accountLabel}</span>
                </span>
            </div>
            {isStaff && <StaffCabinetButton />}
            {/* Кнопка личного кабинета/дефолтного кабинета */}
            <PersonalCabinetButton />
            <SignOutButton />
        </div>
    );
}
