// apps/web/src/app/admin/users/page.tsx
import {createServerClient} from '@supabase/ssr';
import {cookies, headers} from 'next/headers';
import Link from 'next/link';
import {redirect} from 'next/navigation';

import UsersClient from './UsersClient';

import {Button} from '@/components/ui/Button';

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

async function fetchStats(): Promise<{ total: number; active: number; blocked: number; super: number }> {
    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (!host) throw new Error('Host header is missing');
    const base = `${proto}://${host}`;

    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

    // Получаем все пользователи для статистики (без пагинации)
    const res = await fetch(`${base}/admin/api/users/list?page=1&perPage=10000&status=all`, {
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
        return { total: 0, active: 0, blocked: 0, super: 0 };
    }

    const items = json.items;
    return {
        total: items.length,
        active: items.filter((u) => !u.is_blocked).length,
        blocked: items.filter((u) => u.is_blocked).length,
        super: items.filter((u) => u.is_super).length,
    };
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
            get: (n: string) => cookieStore.get(n)?.value, set: () => {
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

    const [data, stats] = await Promise.all([fetchList(q, page, perPage, status), fetchStats()]);

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Заголовок */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                Пользователи
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Управление пользователями системы
                            </p>
                        </div>
                        <Link href="/admin">
                            <Button variant="outline" className="w-full sm:w-auto">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                В админку
                            </Button>
                        </Link>
                    </div>
                </section>

                {/* Клиентский компонент с пользователями */}
                <UsersClient
                    initialUsers={data.items}
                    initialPage={page}
                    initialPerPage={perPage}
                    initialTotal={data.total}
                    initialSearch={q}
                    initialStatus={status}
                    stats={stats}
                />
            </div>
        </main>
    );
}
