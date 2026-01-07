// apps/web/src/app/dashboard/layout.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';

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
            // Нет доступа к бизнесу → показываем сообщение
            if (e.message === 'NO_BIZ_ACCESS') {
                return (
                    <main className="p-6">
                        <h1 className="text-xl font-semibold mb-2">Нет доступа к кабинету</h1>
                        <p className="text-sm text-gray-600">
                            У вашей учётной записи нет ролей <code>owner / admin / manager</code> ни в одном бизнесе.
                        </p>
                        <div className="mt-4">
                            <Link className="underline" href="/b/kezek">Перейти на публичную витрину</Link>
                        </div>
                    </main>
                );
            }
        }
        // Другие ошибки → показываем общее сообщение
        return (
            <main className="p-6">
                <h1 className="text-xl font-semibold mb-2 text-red-600">Ошибка</h1>
                <p className="text-sm text-gray-600">
                    Произошла ошибка при загрузке кабинета. Пожалуйста, попробуйте обновить страницу.
                </p>
                {e instanceof Error && (
                    <p className="text-xs text-gray-500 mt-2">Детали: {e.message}</p>
                )}
                <div className="mt-4">
                    <Link className="underline" href="/b/kezek">Перейти на публичную витрину</Link>
                </div>
            </main>
        );
    }
}
