import MonitoringClient from './MonitoringClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function MonitoringPage() {
    // The shared /admin layout authorizes the current global super-admin.
    return <MonitoringClient />;
}

