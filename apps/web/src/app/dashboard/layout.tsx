// apps/web/src/app/dashboard/layout.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    try {
        const { bizId } = await getBizContextForManagers();

        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
                <div className="grid grid-cols-[280px_1fr]">
                    <aside className="bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 h-screen overflow-y-auto">
                        <div className="p-6 space-y-6">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Кабинет бизнеса</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">ID: {bizId.slice(0, 8)}...</p>
                            </div>
                            <nav className="space-y-1">
                                <Link className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href="/dashboard">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    Главная
                                </Link>
                                <Link className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href="/dashboard/bookings">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Брони
                                </Link>
                                <Link className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href="/dashboard/staff">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Сотрудники
                                </Link>
                                <Link className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href="/dashboard/services">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    Услуги
                                </Link>
                                <Link className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href="/dashboard/branches">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    Филиалы
                                </Link>
                            </nav>
                        </div>
                    </aside>

                    <section className="min-h-screen">{children}</section>
                </div>
            </div>
        );
    } catch (e: unknown) {
        if (e instanceof Error && e.message === 'UNAUTHORIZED') {
            redirect('/b/kezek');
        }
        return (
            <main className="p-6">
                <h1 className="text-xl font-semibold mb-2">Нет доступа к кабинету</h1>
                <p className="text-sm text-gray-600">
                    У вашей учётной записи нет ролей <code>owner / manager / staff</code> ни в одном бизнесе.
                </p>
                <div className="mt-4">
                    <Link className="underline" href="/b/kezek">Перейти на публичную витрину</Link>
                </div>
            </main>
        );
    }
}
