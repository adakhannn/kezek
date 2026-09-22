import { RoleApplicationsClient } from './RoleApplicationsClient';
import { RoleApplicationsHeader } from './RoleApplicationsHeader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function DashboardRoleApplicationsPage() {
    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <RoleApplicationsHeader />

            <RoleApplicationsClient />
        </main>
    );
}
