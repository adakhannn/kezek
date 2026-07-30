import { RoleApplicationsAdminClient } from './RoleApplicationsAdminClient';

import { getT } from '@/app/_components/i18n/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminRoleApplicationsPage() {
    const t = await getT();

    return (
        <div className="space-y-6">
            <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">
                    {t('admin.roleApplications.eyebrow')}
                </p>
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                    {t('admin.roleApplications.title')}
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                    {t('admin.roleApplications.description')}
                </p>
            </div>
            <RoleApplicationsAdminClient />
        </div>
    );
}
