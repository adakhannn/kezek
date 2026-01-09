// apps/web/src/app/dashboard/services/new/page.tsx  (или твой путь)

import NewServicePageClient from './NewServicePageClient';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
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
            <NewServicePageClient branches={branches || []} />
        </LanguageProvider>
    );
}
