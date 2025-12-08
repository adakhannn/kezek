// apps/web/src/app/admin/businesses/page.tsx
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

type Biz = {
    id: string;
    slug: string;
    name: string;
    owner_id: string | null;
    created_at: string;
};

export default async function Page() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!; // ⟵ добавили
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    // 1) авторизация
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/sign-in?redirect=/admin/businesses');

    // 2) проверка супер-админа
    const { data: superRow, error: roleErr } = await supabase
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (roleErr || !superRow) {
        return <main className="p-6">403</main>;
    }

    // 3) список бизнесов (без address/phones)
    const { data: list, error: listErr } = await supabase
        .from('businesses')
        .select('id,slug,name,owner_id,created_at')
        .order('created_at', { ascending: false });

    if (listErr) {
        return (
            <main className="p-6">
                <div className="text-red-600">Ошибка загрузки бизнесов: {listErr.message}</div>
            </main>
        );
    }

    // 4) имена владельцев из auth (user_metadata.full_name) с запасным вариантом email
    const ownerIds = Array.from(new Set((list ?? []).map((b) => b.owner_id).filter(Boolean))) as string[];

    type OwnerInfo = { id: string; name?: string | null; email?: string | null };

    let ownersMap = new Map<string, string>(); // id -> display name
    if (ownerIds.length) {
        const admin = createClient(url, service);

        // Параллельно тянем пользователей по id
        const results = await Promise.all(
            ownerIds.map(async (oid) => {
                try {
                    const { data, error } = await admin.auth.admin.getUserById(oid);
                    if (error || !data?.user) return { id: oid } as OwnerInfo;
                    const meta = (data.user.user_metadata ?? {}) as Partial<{ full_name: string }>;
                    const display =
                        meta.full_name?.trim() ||
                        data.user.email?.trim() ||
                        (data.user as { phone?: string | null }).phone?.trim() ||
                        oid; // на крайний случай — id
                    return { id: oid, name: display, email: data.user.email ?? null } as OwnerInfo;
                } catch {
                    return { id: oid } as OwnerInfo;
                }
            })
        );

        ownersMap = new Map(results.map((r) => [r.id, (r.name ?? r.email ?? r.id)!]));
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Бизнесы</h1>
                        <p className="text-gray-600 dark:text-gray-400">Управление бизнесами в системе</p>
                    </div>
                    <Link href="/admin/businesses/new" className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Создать бизнес
                    </Link>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Название</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Slug</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Владелец</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Действия</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {(list ?? []).map((b: Biz) => (
                            <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-100">{b.name}</td>
                                <td className="p-4 text-sm text-gray-700 dark:text-gray-300 font-mono">{b.slug}</td>
                                <td className="p-4 text-sm text-gray-700 dark:text-gray-300">{b.owner_id ? ownersMap.get(b.owner_id) ?? '—' : '—'}</td>
                                <td className="p-4">
                                    <Link className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline" href={`/admin/businesses/${b.id}`}>
                                        Открыть
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {(!list || list.length === 0) && (
                            <tr>
                                <td className="p-8 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                                    Пока нет бизнесов.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
