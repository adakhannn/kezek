import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import Link from 'next/link';

import {CategoryForm} from '@/components/admin/categories/CategoryForm';
import {Button} from '@/components/ui/Button';

export const dynamic = 'force-dynamic';
type RouteParams = { id: string };
export default async function CategoryEditPage({params}: { params: Promise<RouteParams> }
) {
    const {id} = await params;
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value, set: () => {
            }, remove: () => {
            }
        },
    });
    const {data: {user}} = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;
    const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    const admin = createClient(URL, SERVICE);
    const {data: cat, error} = await admin
        .from('categories')
        .select('id,slug,name_ru,is_active')
        .eq('id', id)
        .maybeSingle();

    if (error) return <div className="p-4">Ошибка: {error.message}</div>;
    if (!cat) return <div className="p-4">Категория не найдена</div>;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
                {/* Заголовок */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                Редактировать категорию
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Измените данные категории
                            </p>
                        </div>
                        <Link href="/admin/categories">
                            <Button variant="outline">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Назад к категориям
                            </Button>
                        </Link>
                    </div>
                </section>

                {/* Форма */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <CategoryForm
                        mode="edit"
                        categoryId={cat.id}
                        initial={{
                            name_ru: cat.name_ru ?? '',
                            slug: cat.slug,
                            is_active: !!cat.is_active
                        }}
                    />
                </section>
            </div>
        </main>
    );
}
