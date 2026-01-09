// apps/web/src/app/dashboard/services/new/page.tsx  (или твой путь)
import ServiceForm from '../ServiceForm';

import { LanguageProvider, useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewServicePage() {
    const { supabase, bizId } = await getBizContextForManagers();

    const { data: branches } = await supabase
        .from('branches')
        .select('id,name')
        .eq('biz_id', bizId)
        .eq('is_active', true)
        .order('name');

    return (
        <LanguageProvider>
            <NewServicePageInner branches={branches || []} />
        </LanguageProvider>
    );
}

function NewServicePageInner({ branches }: { branches: { id: string; name: string }[] }) {
    const { t } = useLanguage();

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">
                {t('services.form.titleNew', 'Новая услуга')}
            </h1>
            <ServiceForm
                initial={{
                    name_ru: '',
                    name_ky: null,
                    name_en: null,
                    duration_min: 60,
                    price_from: 0,
                    price_to: 0,
                    active: true,
                    branch_id: '',
                    branch_ids: [],
                }}
                branches={branches}
                apiBase="/api/services"
            />
        </main>
    );
}
