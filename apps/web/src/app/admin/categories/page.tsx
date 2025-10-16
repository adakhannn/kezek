// apps/web/src/app/admin/categories/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { DeleteCategoryButton } from '@/components/admin/categories/DeleteCategoryButton';

export const dynamic = 'force-dynamic';

type CategoryUsageRow = {
    id: string;
    name_ru: string;
    name_ky: string | null;
    slug: string;
    is_active: boolean;
    usage_count: number;
};

export default async function CategoriesPage() {
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    // 1) Авторизация
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;

    // 2) Новая проверка супер-админа: роль 'super_admin' c biz_id IS NULL
    const { data: superRow, error: superErr } = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (superErr) return <div className="p-4">Ошибка: {superErr.message}</div>;
    if (!superRow) return <div className="p-4">Нет доступа</div>;

    // 3) Данные категорий
    const { data: rpcData, error } = await supa.rpc('categories_with_usage');
    if (error) return <div className="p-4">Ошибка: {error.message}</div>;

    const list: CategoryUsageRow[] = Array.isArray(rpcData) ? (rpcData as CategoryUsageRow[]) : [];

    return (
        <div className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Категории бизнеса</h1>
                <div className="flex gap-3 text-sm">
                    <Link href="/admin/businesses" className="underline">← К бизнесам</Link>
                    <Link href="/admin/categories/new" className="inline-flex items-center rounded border px-3 py-1.5 hover:bg-gray-50">
                        + Новая категория
                    </Link>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full border-collapse">
                    <thead className="text-left text-sm text-gray-500">
                    <tr>
                        <th className="border-b p-2">Название</th>
                        <th className="border-b p-2">Slug</th>
                        <th className="border-b p-2">Статус</th>
                        <th className="border-b p-2">Используется</th>
                        <th className="border-b p-2 w-48">Действия</th>
                    </tr>
                    </thead>
                    <tbody className="text-sm">
                    {list.map((c) => (
                        <tr key={c.id} className="align-top">
                            <td className="border-b p-2">{c.name_ru}{c.name_ky ? ` / ${c.name_ky}` : ''}</td>
                            <td className="border-b p-2">{c.slug}</td>
                            <td className="border-b p-2">{c.is_active ? 'Активна' : 'Выключена'}</td>
                            <td className="border-b p-2">{c.usage_count}</td>
                            <td className="border-b p-2">
                                <div className="flex items-center gap-3">
                                    <Link href={`/admin/categories/${c.id}`} className="underline">Редактировать</Link>
                                    <DeleteCategoryButton id={c.id} slug={c.slug} />
                                </div>
                            </td>
                        </tr>
                    ))}
                    {list.length === 0 && (
                        <tr>
                            <td className="p-3 text-gray-500" colSpan={5}>Категорий пока нет.</td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
