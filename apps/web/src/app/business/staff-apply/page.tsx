import { RoleApplicationForm } from '../role-apply/RoleApplicationForm';
import { RoleApplicationPageHeader } from '../role-apply/RoleApplicationPageHeader';

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffApplicationPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile, error: profileError } = user
        ? await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        : { data: null, error: null };
    const needsProfileName = !!user && !profileError && !profile?.full_name?.trim();

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
            <RoleApplicationPageHeader mode="staff" />
            <RoleApplicationForm isAuthenticated={!!user} mode="staff" needsProfileName={needsProfileName} />
        </main>
    );
}
