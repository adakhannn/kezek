import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';

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

    // Проверка супер-админа (дублируем внутри страницы на всякий случай)
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    if (!isSuper) return <main className="p-6">403</main>;

    // Бизнесы + получим email владельца через view
    const { data: list } = await supabase
        .from('businesses')
        .select('id,slug,name,address,phones,owner_id,created_at')
        .order('created_at', { ascending: false });

    // Соберём email владельцев одним запросом
    const ownerIds = Array.from(new Set((list ?? []).map(b => b.owner_id).filter(Boolean))) as string[];
    let ownersMap = new Map<string, string>();
    if (ownerIds.length) {
        const { data: owners } = await supabase
            .from('auth_users_view') // у нас есть такая view
            .select('id,email')
            .in('id', ownerIds);
        ownersMap = new Map((owners ?? []).map(r => [r.id as string, (r.email as string) ?? '']));
    }

    return (
        <main className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Бизнесы</h2>
                <Link href="/admin/businesses/new" className="border px-3 py-1 rounded">+ Создать бизнес</Link>
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
                    </tbody>
                </table>
            </div>
        </main>
    );
}
