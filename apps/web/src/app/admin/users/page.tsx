// apps/web/src/app/admin/users/page.tsx
import {createServerClient} from '@supabase/ssr';
import {cookies, headers} from 'next/headers';
import Link from 'next/link';
import {redirect} from 'next/navigation';

export const dynamic = 'force-dynamic';

type UserListItem = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    last_sign_in_at: string | null;
    is_super: boolean;
};

type ListOk = {
    ok: true;
    items: UserListItem[];
    page: number;
    perPage: number;
    total: number;
};

type ListErr = { ok: false; error?: string };

async function fetchList(search: string, page: number, perPage: number): Promise<ListOk> {
    const sp = new URLSearchParams({
        q: search,
        page: String(page),
        perPage: String(perPage),
    }).toString();

    // Абсолютный базовый URL из текущих заголовков
    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (!host) throw new Error('Host header is missing');
    const base = `${proto}://${host}`;

    // Пробрасываем cookie вручную (для SSR-запроса к API-роуту)
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await fetch(`${base}/admin/api/users/list?${sp}`, {
        cache: 'no-store',
        headers: {
            cookie: cookieHeader,
            accept: 'application/json',
        },
    });

    let json: ListOk | ListErr | null = null;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
        json = (await res.json()) as ListOk | ListErr;
    } else {
        // Если не JSON — считаем ошибкой и покажем тело
        const text = await res.text();
        throw new Error(text.slice(0, 1500));
    }

    if (!res.ok || !json || json.ok !== true) {
        const msg = json && 'error' in json && json.error ? json.error : `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json;
}

export default async function UsersListPage({
                                                searchParams,
                                            }: {
    searchParams: { q?: string; page?: string; perPage?: string };
}) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(url, anon, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value,
            set: () => {
            },
            remove: () => {
            },
        },
    });

    // Сессия и доступ
    const {
        data: {user},
    } = await supa.auth.getUser();
    if (!user) redirect('/auth/sign-in?redirect=/admin/users');

    const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    const q = (searchParams.q ?? '').trim();
    const page = Number(searchParams.page ?? '1');
    const perPage = Number(searchParams.perPage ?? '50');

    const data = await fetchList(q, page, perPage);

    return (
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Пользователи</h1>
                <div className="flex gap-3 text-sm">
                    <Link href="/admin" className="underline">
                        ← В админку
                    </Link>
                    <Link href="/admin/users/new" className="border px-3 py-1.5 rounded hover:bg-gray-50">
                        + Новый пользователь
                    </Link>
                </div>
            </div>

            <form action="/admin/users" className="flex gap-2">
                <input
                    name="q"
                    defaultValue={q}
                    className="border rounded px-3 py-2 w-full max-w-md"
                    placeholder="Поиск: email, телефон, имя, id"
                />
                <button className="border rounded px-3 py-2">Искать</button>
            </form>

            <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full border-collapse">
                    <thead className="text-left text-sm text-gray-500">
                    <tr>
                        <th className="border-b p-2">Имя</th>
                        <th className="border-b p-2">Email</th>
                        <th className="border-b p-2">Телефон</th>
                        <th className="border-b p-2">Последний вход</th>
                        <th className="border-b p-2 w-28">Действия</th>
                    </tr>
                    </thead>
                    <tbody className="text-sm">
                    {data.items.map((u) => (
                        <tr key={u.id}>
                            <td className="border-b p-2">
                                {u.full_name || '—'}{' '}
                                {u.is_super && (
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 border rounded">super</span>
                                )}
                            </td>
                            <td className="border-b p-2">{u.email || '—'}</td>
                            <td className="border-b p-2">{u.phone || '—'}</td>
                            <td className="border-b p-2">
                                {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('ru-RU') : '—'}
                            </td>
                            <td className="border-b p-2">
                                <Link className="underline" href={`/admin/users/${u.id}`}>
                                    Открыть
                                </Link>
                            </td>
                        </tr>
                    ))}
                    {data.items.length === 0 && (
                        <tr>
                            <td className="p-3 text-gray-500" colSpan={5}>
                                Ничего не найдено.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
