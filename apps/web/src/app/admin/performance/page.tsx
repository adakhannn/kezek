// apps/web/src/app/admin/performance/page.tsx
import { Suspense } from 'react';

import PerformanceClient from './PerformanceClient';

export const dynamic = 'force-dynamic';

export default function PerformancePage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Мониторинг производительности</h1>
            <Suspense fallback={<div>Загрузка...</div>}>
                <PerformanceClient />
            </Suspense>
        </div>
    );
}

