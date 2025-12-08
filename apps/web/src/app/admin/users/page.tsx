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
    is_blocked: boolean;
    block_reason?: string | null;
};

type ListOk = {
    ok: true;
    items: UserListItem[];
    page: number;
    perPage: number;
    total: number;
};

type ListErr = { ok: false; error?: string };

async function fetchList(search: string, page: number, perPage: number, status: string): Promise<ListOk> {
    const sp = new URLSearchParams({
        q: search,
        page: String(page),
        perPage: String(perPage),
        status,
    }).toString();

    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (!host) throw new Error('Host header is missing');
    const base = `${proto}://${host}`;

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
        const text = await res.text();
        throw new Error(text.slice(0, 1500));
    }

    if (!res.ok || !json || json.ok !== true) {
        const msg = json && 'error' in json && json.error ? json.error : `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json;
}

export default async function UsersListPage(
    {searchParams}: { searchParams: Promise<{ q?: string; page?: string; perPage?: string; status?: string }> }
) {
    const sp = await searchParams;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(url, anon, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value, set: () => {
            }, remove: () => {
            }
        },
    });

    const {data: {user}} = await supa.auth.getUser();
    if (!user) redirect('/auth/sign-in?redirect=/admin/users');

    const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    const q = (sp.q ?? '').trim();
    const page = Number(sp.page ?? '1');
    const perPage = Number(sp.perPage ?? '50');
    const status = (sp.status ?? 'all');

    const data = await fetchList(q, page, perPage, status);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Пользователи</h1>
                        <p className="text-gray-600 dark:text-gray-400">Управление пользователями системы</p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/admin" className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            В админку
                        </Link>
                        <Link href="/admin/users/new" className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Новый пользователь
                        </Link>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-lg border border-gray-200 dark:border-gray-800">
                <form action="/admin/users" className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            name="q"
                            defaultValue={q}
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                            placeholder="Поиск: email, телефон, имя, id"
                        />
                    </div>
                    <select
                        name="status"
                        defaultValue={status}
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                        title="Статус"
                    >
                        <option value="all">Все</option>
                        <option value="active">Активные</option>
                        <option value="blocked">Заблокированные</option>
                    </select>
                    <button className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200">
                        Искать
                    </button>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full">
                        <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Имя</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Email</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Телефон</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4">Последний вход</th>
                            <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider p-4 w-28">Действия</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {data.items.map((u) => (
                            <tr key={u.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${u.is_blocked ? 'opacity-60' : ''}`}>
                                <td className="p-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.full_name || '—'}</span>
                                        {u.is_super && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                                super
                                            </span>
                                        )}
                                        {u.is_blocked && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                                blocked
                                            </span>
                                        )}
                                    </div>
                                    {u.is_blocked && u.block_reason && (
                                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                            Причина: {u.block_reason}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-sm text-gray-700 dark:text-gray-300">{u.email || '—'}</td>
                                <td className="p-4 text-sm text-gray-700 dark:text-gray-300">{u.phone || '—'}</td>
                                <td className="p-4 text-sm text-gray-700 dark:text-gray-300">
                                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('ru-RU') : '—'}
                                </td>
                                <td className="p-4">
                                    <Link className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline" href={`/admin/users/${u.id}`}>
                                        Открыть
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {data.items.length === 0 && (
                            <tr>
                                <td className="p-8 text-center text-gray-500 dark:text-gray-400" colSpan={5}>
                                    Ничего не найдено.
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
