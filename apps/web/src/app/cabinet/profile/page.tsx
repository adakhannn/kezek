// apps/web/src/app/cabinet/profile/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import ProfilePageClient from './ProfilePageClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ProfilePage() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (n) => cookieStore.get(n)?.value,
            },
        }
    );

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
        redirect('/auth/sign-in');
    }

    return <ProfilePageClient />;
}

