// apps/web/src/app/cabinet/profile/page.tsx
import { redirect } from 'next/navigation';

import ProfilePageClient from './ProfilePageClient';

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ProfilePage() {
    const supabase = await createSupabaseServerClient();

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
        redirect('/auth/sign-in');
    }

    return <ProfilePageClient />;
}

