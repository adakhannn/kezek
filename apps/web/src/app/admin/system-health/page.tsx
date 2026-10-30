import SystemHealthClient from './SystemHealthClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function SystemHealthPage() {
    // The shared /admin layout authorizes the current global super-admin.
    // Platform diagnostics must not require a separate business membership.
    return <SystemHealthClient />;
}

