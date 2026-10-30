import FunnelAnalyticsClient from './FunnelAnalyticsClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function FunnelAnalyticsPage() {
    // The enclosing admin layout verifies the global super-admin role.
    // Global funnel analytics does not require a selected business.
    return <FunnelAnalyticsClient />;
}

