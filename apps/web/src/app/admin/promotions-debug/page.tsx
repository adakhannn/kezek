import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { PromotionsDebugClient } from './PromotionsDebugClient';

export default async function PromotionsDebugPage() {
    const cookieStore = await cookies();
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
        cookies: {
            get: (name: string) => cookieStore.get(name)?.value,
            set: () => {},
            remove: () => {},
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/sign-in');
    }

    // Проверяем, что пользователь - суперадмин
    const { data: roleData } = await supabase
        .from('user_roles')
        .select('roles!inner(key)')
        .eq('user_id', user.id)
        .eq('roles.key', 'super_admin')
        .single();

    if (!roleData) {
        redirect('/dashboard');
    }

    return <PromotionsDebugClient />;
}

