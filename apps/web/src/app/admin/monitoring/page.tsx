import { redirect } from 'next/navigation';

import MonitoringClient from './MonitoringClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function MonitoringPage() {
    try {
        // Проверяем доступ (только для менеджеров/админов)
        await getBizContextForManagers();
        
        return <MonitoringClient />;
    } catch {
        // Если нет доступа, редиректим на главную админки
        redirect('/admin');
    }
}

