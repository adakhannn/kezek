
import { ManualBusinessCreateForm, type ManualBusinessCategory } from './ManualBusinessCreateForm';

import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';

export default async function ManualBusinessCreatePage() {
    const admin = createSupabaseAdminClient();

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
