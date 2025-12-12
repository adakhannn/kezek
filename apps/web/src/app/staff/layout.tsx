// apps/web/src/app/staff/layout.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getStaffContext } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
    try {
        const { staffId } = await getStaffContext();

        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
                <div className="grid grid-cols-[280px_1fr]">
                    <aside className="bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 h-screen overflow-y-auto">
                        <div className="p-6 space-y-6">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Кабинет сотрудника</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">ID: {staffId.slice(0, 8)}...</p>
                            </div>
                            <nav className="space-y-1">
                                <Link className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href="/staff">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    Главная
                                </Link>
                                <Link className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href="/staff/bookings">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Мои записи
                                </Link>
                                <Link className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href="/staff/schedule">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Расписание
                                </Link>
                            </nav>
                        </div>
                    </aside>

                    <section className="min-h-screen">{children}</section>
                </div>
            </div>
        );
    } catch (e: unknown) {
        if (e instanceof Error && (e.message === 'UNAUTHORIZED' || e.message === 'NO_STAFF_ACCESS' || e.message === 'NO_STAFF_RECORD')) {
            redirect('/');
        }
        return (
            <main className="p-6">
                <h1 className="text-xl font-semibold mb-2">Нет доступа к кабинету сотрудника</h1>
                <p className="text-sm text-gray-600">
                    У вашей учётной записи нет роли <code>staff</code> ни в одном бизнесе.
                </p>
                <div className="mt-4">
                    <Link className="underline" href="/">Перейти на главную</Link>
                </div>
            </main>
        );
    }
}


