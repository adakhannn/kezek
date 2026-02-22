import { redirect } from 'next/navigation';

import SystemHealthClient from './SystemHealthClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function SystemHealthPage() {
    try {
        // Проверяем доступ (только для менеджеров/админов)
        await getBizContextForManagers();
        
        return <SystemHealthClient />;
    } catch {
        // Если нет доступа, редиректим на главную админки
        redirect('/admin');
    }
}

