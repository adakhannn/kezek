import { BusinessContactSettingsForm } from './BusinessContactSettingsForm';
import { BusinessTimeZoneSettingsForm } from './BusinessTimeZoneSettingsForm';

import { getServerLocale, getT } from '@/app/_components/i18n/server';
import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { isBusinessOwner } from '@/lib/staffApplicationApprovalService';
import { getServiceClient } from '@/lib/supabaseService';
import { getBusinessTimezone } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function BusinessSettingsPage() {
    const t = getT(await getServerLocale());
    const { supabase, userId, bizId, business } = await getBizContextForManagers();
    const admin = getServiceClient();
    const [{ data: isSuper }, owner] = await Promise.all([
        supabase.rpc('is_super_admin'),
        isBusinessOwner({ admin, userId, bizId }),
    ]);

    if (!isSuper && !owner) {
        return (
            <main className="mx-auto max-w-4xl p-6">
                <AlertBanner
                    variant="danger"
                    title={t('business.contactSettings.noAccessTitle')}
                    message={t('business.contactSettings.noAccessDescription')}
                />
            </main>
        );
    }

    const { data, error } = await admin
        .from('businesses')
        .select('contact_phone,contact_whatsapp,contact_email,website_url,tz')
        .eq('id', bizId)
        .maybeSingle();

    // FE-08: a blank form after a failed read would erase the real contacts on save.
    if (error) {
        logError('BusinessSettingsPage', 'Failed to load business contacts', { bizId, error });
        return <LoadFailedNotice page />;
    }

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
            <PageHeader
                title={t('business.contactSettings.title')}
                description={`${t('business.contactSettings.publicContacts')} ${business?.name || t('business.contactSettings.selectedBusiness')}`}
            />
            <BusinessContactSettingsForm
                initial={{
                    contact_phone: data?.contact_phone ?? '',
                    contact_whatsapp: data?.contact_whatsapp ?? '',
                    contact_email: data?.contact_email ?? '',
                    website_url: data?.website_url ?? '',
                }}
            />
            <BusinessTimeZoneSettingsForm initial={getBusinessTimezone(data?.tz)} />
        </main>
    );
}
