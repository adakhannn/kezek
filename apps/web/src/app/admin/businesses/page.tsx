// apps/web/src/app/admin/businesses/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

type Biz = {
    id: string;
    slug: string;
    name: string;
    address: string | null;
    phones: string[] | null;
    owner_id: string | null;
    created_at: string;
};

export default async function Page() {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anon, {
        cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    // 1) авторизация
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/sign-in?redirect=/admin/businesses');

    // 2) новая проверка супер-админа через view user_roles_with_user
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

    // 3) список бизнесов
    const { data: list, error: listErr } = await supabase
        .from('businesses')
        .select('id,slug,name,address,phones,owner_id,created_at')
        .order('created_at', { ascending: false });

    if (listErr) {
        return (
            <main className="p-6">
                <div className="text-red-600">Ошибка загрузки бизнесов: {listErr.message}</div>
            </main>
        );
    }

    // 4) e-mail владельцев (через view с auth.users)
    const ownerIds = Array.from(new Set((list ?? []).map(b => b.owner_id).filter(Boolean))) as string[];
    let ownersMap = new Map<string, string>();
    if (ownerIds.length) {
        const { data: owners, error: ownersErr } = await supabase
            .from('auth_users_view') // твоя вьюха
            .select('id,email')
            .in('id', ownerIds);

        if (!ownersErr) {
            ownersMap = new Map((owners ?? []).map(r => [r.id as string, (r.email as string) ?? '']));
        }
    }

    return (
        <main className="space-y-4">
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
                        <th className="p-2">Адрес</th>
                        <th className="p-2">Телефоны</th>
                        <th className="p-2">Действия</th>
                    </tr>
                    </thead>
                    <tbody>
                    {(list ?? []).map((b: Biz) => (
                        <tr key={b.id} className="border-t">
                            <td className="p-2">{b.name}</td>
                            <td className="p-2">{b.slug}</td>
                            <td className="p-2">{b.owner_id ? ownersMap.get(b.owner_id) : '—'}</td>
                            <td className="p-2">{b.address ?? '—'}</td>
                            <td className="p-2">{(b.phones ?? []).join(', ')}</td>
                            <td className="p-2">
                                <Link className="underline" href={`/admin/businesses/${b.id}`}>Открыть</Link>
                            </td>
                        </tr>
                    ))}
                    {(!list || list.length === 0) && (
                        <tr>
                            <td className="p-4 text-gray-500" colSpan={6}>Пока нет бизнесов.</td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}

