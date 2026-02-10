// apps/web/src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation';

import { DashboardLayoutClient } from './components/DashboardLayoutClient';
import { MobileSidebar } from './components/MobileSidebar';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    try {
        const { bizId } = await getBizContextForManagers();

        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
                <div className="flex">
                    <MobileSidebar bizId={bizId} />
                    <section className="flex-1 min-h-screen lg:ml-0 pt-16 lg:pt-0">{children}</section>
                </div>
            </div>
        );
    } catch (e: unknown) {
        if (e instanceof Error) {
            // Не авторизован → редирект на публичную страницу
            if (e.message === 'UNAUTHORIZED') {
                redirect('/b/kezek');
            }
            // Нет доступа к бизнесу → показываем сообщение с улучшенными инструкциями
            if (e.message === 'NO_BIZ_ACCESS') {
                // Диагностическая информация уже логируется в getBizContextForManagers()
                // В dev режиме можно было бы извлечь её из логов, но для простоты
                // показываем общее сообщение с инструкциями
                return <DashboardLayoutClient errorType="NO_BIZ_ACCESS" />;
            }
        }
        // Другие ошибки → показываем общее сообщение
        return (
            <DashboardLayoutClient 
                errorType="GENERAL" 
                errorMessage={e instanceof Error ? e.message : undefined}
            />
        );
    }
}
