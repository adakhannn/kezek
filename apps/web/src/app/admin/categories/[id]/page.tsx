import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';

import {CategoryForm} from '@/components/admin/categories/CategoryForm';

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
        <div className="p-4 space-y-4">
            <h1 className="text-2xl font-semibold">Редактировать категорию</h1>
            <CategoryForm
                mode="edit"
                categoryId={cat.id}
                initial={{
                    name_ru: cat.name_ru ?? '',
                    slug: cat.slug,
                    is_active: !!cat.is_active
                }}
            />
        </div>
    );
}
