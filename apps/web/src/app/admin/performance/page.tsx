// apps/web/src/app/admin/performance/page.tsx
import { Suspense } from 'react';

import PerformanceClient from './PerformanceClient';

import { getT } from '@/app/_components/i18n/server';


export const dynamic = 'force-dynamic';

export default function PerformancePage() {
    const t = getT('ru');
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">{t('admin.performance.title', 'Мониторинг производительности')}</h1>
            <Suspense fallback={<div>{t('common.loading', 'Загрузка...')}</div>}>
                <PerformanceClient />
            </Suspense>
        </div>
    );
}

