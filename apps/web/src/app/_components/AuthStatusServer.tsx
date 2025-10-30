// AuthStatusServer.tsx
import { createServerClient } from '@supabase/ssr';
import { unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { SignOutButton } from './SignOutButton';


export const dynamic = 'force-dynamic';

export async function AuthStatusServer() {
    noStore();

    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            // ВАЖНО: в RSC только get
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    const { data } = await supabase.auth.getUser();
    const user = data.user;

    return (
        <div className="flex items-center gap-3 text-sm">
            {user ? (
                <>
          <span className="text-gray-600">
            Вы вошли как <b>{user.email ?? user.phone ?? 'аккаунт'}</b>
          </span>
                    <Link href="/dashboard" className="border rounded px-3 py-1">
                        Кабинет
                    </Link>
                    <SignOutButton />
                </>
            ) : (
                <>
                    <span className="text-gray-600">Вы не авторизованы</span>
                    <Link href="/auth/sign-in" className="border rounded px-3 py-1">
                        Войти
                    </Link>
                </>
            )}
        </div>
    );
}
