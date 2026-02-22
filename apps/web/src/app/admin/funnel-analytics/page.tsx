import { redirect } from 'next/navigation';

import FunnelAnalyticsClient from './FunnelAnalyticsClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function FunnelAnalyticsPage() {
    try {
        // Проверяем доступ (только для менеджеров/админов)
        await getBizContextForManagers();
        
        return <FunnelAnalyticsClient />;
    } catch {
        // Если нет доступа, редиректим на главную админки
        redirect('/admin');
    }
}

