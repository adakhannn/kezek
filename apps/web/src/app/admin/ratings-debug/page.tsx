import { Suspense } from 'react';

import { RatingsDebugClient } from './RatingsDebugClient';

import { getT } from '@/app/_components/i18n/server';


export const dynamic = 'force-dynamic';

export default async function RatingsDebugPage() {
    const t = await getT();
    return (
        <Suspense fallback={<div className="text-gray-500">{t('common.loading', 'Загрузка…')}</div>}>
            <RatingsDebugClient />
        </Suspense>
    );
}
