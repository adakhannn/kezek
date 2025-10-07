import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { CategoryForm } from '@/components/admin/categories/CategoryForm';

export const dynamic = 'force-dynamic';

export default async function CategoryNewPage() {
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;
    const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-2xl font-semibold">Новая категория</h1>
            <CategoryForm mode="create" />
        </div>
    );
}

