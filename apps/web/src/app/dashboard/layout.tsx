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
            <div className="min-h-screen grid grid-cols-[240px_1fr]">
                <aside className="border-r p-4 space-y-3">
                    <div className="text-sm text-gray-500">Кабинет бизнеса</div>
                    <nav className="space-y-2">
                        <Link className="block hover:underline" href="/dashboard">Главная</Link>
                        <Link className="block hover:underline" href="/dashboard/bookings">Брони</Link>
                        <Link className="block hover:underline" href="/dashboard/staff">Сотрудники</Link>
                        <Link className="block hover:underline" href="/dashboard/services">Услуги</Link>
                        <Link className="block hover:underline" href="/dashboard/branches">Филиалы</Link>
                    </nav>

                    <div className="text-xs text-gray-400 pt-4">biz: {bizId}</div>
                </aside>

                <section>{children}</section>
            </div>
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        if (e?.message === 'UNAUTHORIZED') {
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
