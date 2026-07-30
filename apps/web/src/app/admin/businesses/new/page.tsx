import { createClient } from '@supabase/supabase-js';

import { ManualBusinessCreateForm, type ManualBusinessCategory } from './ManualBusinessCreateForm';

export const dynamic = 'force-dynamic';

export default async function ManualBusinessCreatePage() {
    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await admin
        .from('categories')
        .select('id,slug,name_ru,is_active')
        .order('name_ru', { ascending: true });

    return (
        <ManualBusinessCreateForm
            categories={(data ?? [])
                .filter((category) => category.is_active !== false)
                .map(({ id, slug, name_ru }) => ({ id, slug, name_ru })) as ManualBusinessCategory[]}
            categoriesLoadError={error?.message ?? null}
        />
    );
}
