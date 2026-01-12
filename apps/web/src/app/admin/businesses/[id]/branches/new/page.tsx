// apps/web/src/app/admin/businesses/[id]/branches/new/page.tsx
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { BranchForm } from '@/components/admin/branches/BranchForm';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';
type RouteParams = { id: string };
export default async function BranchNewPage({ params }: { params: Promise<RouteParams> }) {
    const { id } = await params;
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;
    const { data: isSuper } = await supa.rpc('is_super_admin');
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    const admin = createClient(URL, SERVICE);
    const { data: biz } = await admin.from('businesses').select('id,name').eq('id', id).maybeSingle();

    if (!biz) return <div className="p-4">Бизнес не найден</div>;

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent mb-2">
                            Новый филиал
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Бизнес: <span className="font-medium text-gray-900 dark:text-gray-100">{biz.name}</span>
                        </p>
                    </div>
                    <Link
                        href={`/admin/businesses/${biz.id}/branches`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        К списку филиалов
                    </Link>
                </div>
            </div>

            {/* Форма */}
            <Card className="p-6">
                <BranchForm mode="create" bizId={biz.id} />
            </Card>
        </div>
    );
}
