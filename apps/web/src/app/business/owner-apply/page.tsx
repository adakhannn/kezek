import { RoleApplicationForm } from '../role-apply/RoleApplicationForm';
import { RoleApplicationPageHeader } from '../role-apply/RoleApplicationPageHeader';

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function OwnerApplicationPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
            <RoleApplicationPageHeader mode="owner" />
            <RoleApplicationForm isAuthenticated={!!user} mode="owner" />
        </main>
    );
}
