import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { PromotionsDebugClient } from './PromotionsDebugClient';

import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';

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
        data: { user }, error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/auth/sign-in');
    }

    // Проверяем, что пользователь - суперадмин
    const { isSuperAdmin } = await checkCurrentUserIsSuperAdmin(
        supabase,
        user.id,
    );

    if (!isSuperAdmin) {
        redirect('/dashboard');
    }

    return <PromotionsDebugClient />;
}

