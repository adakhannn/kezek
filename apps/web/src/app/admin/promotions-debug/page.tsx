import { redirect } from 'next/navigation';

import { PromotionsDebugClient } from './PromotionsDebugClient';

import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export default async function PromotionsDebugPage() {
    const supabase = await createSupabaseServerClient();

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

