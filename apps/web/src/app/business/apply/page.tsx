import type { BusinessCategoryOption } from './BusinessApplicationForm';
import { BusinessApplicationPageContent } from './BusinessApplicationPageContent';

import { selectBusinessApplicationEmail } from '@/lib/businessApplicationDefaults';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function BusinessApplicationPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    let categories: BusinessCategoryOption[] = [];
    let initialValues = {
        contact_name: '',
        phone: '',
        email: '',
        city: 'Ош',
    };

    if (user) {
        const admin = createSupabaseAdminClient();
        const [categoriesResult, profileResult, notificationEmailsResult] = await Promise.all([
            admin
                .from('categories')
                .select('slug,name_ru')
                .eq('is_active', true)
                .order('name_ru', { ascending: true }),
            supabase
                .from('profiles')
                .select('full_name,phone')
                .eq('id', user.id)
                .maybeSingle(),
            supabase
                .from('user_notification_emails')
                .select('email,verified,enabled')
                .eq('user_id', user.id)
                .eq('verified', true),
        ]);

        categories = (categoriesResult.data ?? []).flatMap((category) => (
            typeof category.slug === 'string' && typeof category.name_ru === 'string'
                ? [{ slug: category.slug, name: category.name_ru }]
                : []
        ));

        const metadata = user.user_metadata as {
            full_name?: unknown;
            phone?: unknown;
        } | null;
        const metadataName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : '';
        const metadataPhone = typeof metadata?.phone === 'string' ? metadata.phone.trim() : '';

        initialValues = {
            contact_name: profileResult.data?.full_name?.trim() || metadataName,
            phone: profileResult.data?.phone?.trim() || user.phone?.trim() || metadataPhone,
            email: selectBusinessApplicationEmail({
                accountEmail: user.email,
                notificationEmails: notificationEmailsResult.data,
            }),
            city: 'Ош',
        };
    }

    return (
        <BusinessApplicationPageContent
            categories={categories}
            initialValues={initialValues}
            isAuthenticated={Boolean(user)}
        />
    );
}
