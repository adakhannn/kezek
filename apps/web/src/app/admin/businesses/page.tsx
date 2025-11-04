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
        <main className="space-y-4 p-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Бизнесы</h2>
                <Link href="/admin/businesses/new" className="border px-3 py-1 rounded">
                    + Создать бизнес
                </Link>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                    <tr className="text-left">
                        <th className="p-2">Название</th>
                        <th className="p-2">Slug</th>
                        <th className="p-2">Владелец</th>
                        <th className="p-2">Действия</th>
                    </tr>
                    </thead>
                    <tbody>
                    {(list ?? []).map((b: Biz) => (
                        <tr key={b.id} className="border-t">
                            <td className="p-2">{b.name}</td>
                            <td className="p-2">{b.slug}</td>
                            <td className="p-2">{b.owner_id ? ownersMap.get(b.owner_id) ?? '—' : '—'}</td>
                            <td className="p-2">
                                <Link className="underline" href={`/admin/businesses/${b.id}`}>
                                    Открыть
                                </Link>
                            </td>
                        </tr>
                    ))}
                    {(!list || list.length === 0) && (
                        <tr>
                            <td className="p-4 text-gray-500" colSpan={4}>
                                Пока нет бизнесов.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
