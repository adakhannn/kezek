// apps/web/src/app/cabinet/profile/page.tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import ProfilePageClient from './ProfilePageClient';

import { getT } from '@/app/_components/i18n/server';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getT();
    return { title: t('cabinet.meta.title', 'Kezek — личный кабинет') };
}

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

