// apps/web/src/app/network-check/page.tsx
// Public diagnostic page (R25-31, step 0 of docs/SUPABASE_ACCESS_OPTIONS.md): not linked from the
// navigation and not indexed. The owner opens it in a network where Kezek does not work.
import type { Metadata } from 'next';

import NetworkCheckClient from './NetworkCheckClient';

import { getT } from '@/app/_components/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getT();
    return {
        title: t('networkCheck.meta.title', 'Проверка сети'),
        robots: { index: false, follow: false },
    };
}

export default function NetworkCheckPage() {
    return <NetworkCheckClient />;
}
