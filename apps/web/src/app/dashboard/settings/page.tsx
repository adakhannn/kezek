import { BusinessContactSettingsForm } from './BusinessContactSettingsForm';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { getBizContextForManagers } from '@/lib/authBiz';
import { isBusinessOwner } from '@/lib/staffApplicationApprovalService';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function BusinessSettingsPage() {
    const { supabase, userId, bizId, business } = await getBizContextForManagers();
    const admin = getServiceClient();
    const [{ data: isSuper }, owner] = await Promise.all([
        supabase.rpc('is_super_admin'),
        isBusinessOwner({ admin: admin as never, userId, bizId }),
    ]);

    if (!isSuper && !owner) {
        return (
            <main className="mx-auto max-w-4xl p-6">
                <AlertBanner
                    variant="danger"
                    title="Нет доступа"
                    message="Публичные контакты может изменять только владелец бизнеса."
                />
            </main>
        );
    }

    const { data } = await admin
        .from('businesses')
        .select('contact_phone,contact_whatsapp,contact_email,website_url')
        .eq('id', bizId)
        .maybeSingle();

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
            <PageHeader
                title="Настройки бизнеса"
                description={`Публичные контакты ${business?.name || 'выбранного бизнеса'}`}
            />
            <BusinessContactSettingsForm
                initial={{
                    contact_phone: data?.contact_phone ?? '',
                    contact_whatsapp: data?.contact_whatsapp ?? '',
                    contact_email: data?.contact_email ?? '',
                    website_url: data?.website_url ?? '',
                }}
            />
        </main>
    );
}
