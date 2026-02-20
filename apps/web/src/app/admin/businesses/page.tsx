// apps/web/src/app/admin/businesses/page.tsx
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getT } from '@/app/_components/i18n/server';

type Biz = {
    id: string;
    slug: string;
    name: string;
    owner_id: string | null;
    created_at: string;
    is_approved: boolean | null;
    categories: string[] | null;
    address: string | null;
};

export default async function Page() {
    const t = getT('ru');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
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

    // 3) список бизнесов с дополнительными полями
    const { data: list, error: listErr } = await supabase
        .from('businesses')
        .select('id,slug,name,owner_id,created_at,is_approved,categories,address')
        .order('created_at', { ascending: false });

    if (listErr) {
        return (
            <main className="p-6">
                <div className="text-red-600">{t('admin.businesses.error.load', 'Ошибка загрузки бизнесов')}: {listErr.message}</div>
            </main>
        );
    }

    // 4) имена владельцев из auth
    const ownerIds = Array.from(new Set((list ?? []).map((b) => b.owner_id).filter(Boolean))) as string[];

    type OwnerInfo = { id: string; name?: string | null; email?: string | null };

    let ownersMap = new Map<string, string>();
    if (ownerIds.length) {
        const admin = createClient(url, service);

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
                        oid;
                    return { id: oid, name: display, email: data.user.email ?? null } as OwnerInfo;
                } catch {
                    return { id: oid } as OwnerInfo;
                }
            })
        );

        ownersMap = new Map(results.map((r) => [r.id, (r.name ?? r.email ?? r.id)!]));
    }

    // 5) Статистика для каждого бизнеса (филиалы, сотрудники)
    const admin = createClient(url, service);
    const businessIds = (list ?? []).map((b) => b.id);
    
    const [branchesData, staffData] = await Promise.all([
        admin
            .from('branches')
            .select('biz_id')
            .in('biz_id', businessIds),
        admin
            .from('staff')
            .select('biz_id')
            .in('biz_id', businessIds),
    ]);

    const branchesCount = new Map<string, number>();
    (branchesData.data || []).forEach((b) => {
        branchesCount.set(b.biz_id, (branchesCount.get(b.biz_id) || 0) + 1);
    });

    const staffCount = new Map<string, number>();
    (staffData.data || []).forEach((s) => {
        staffCount.set(s.biz_id, (staffCount.get(s.biz_id) || 0) + 1);
    });

    const approvedCount = (list ?? []).filter((b) => b.is_approved === true).length;
    const totalCount = (list ?? []).length;

    return (
        <div className="space-y-6">
            {/* Заголовок с действиями */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                        {t('admin.businesses.title', 'Бизнесы')}
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('admin.businesses.stats.total', 'Всего')}: {totalCount} • {t('admin.businesses.stats.approved', 'Одобрено')}: {approvedCount}
                    </p>
                </div>
                <Link
                    href="/admin/businesses/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('admin.businesses.create', 'Создать бизнес')}
                </Link>
            </div>

            {/* Список бизнесов */}
            {(!list || list.length === 0) ? (
                <div className="text-center py-12 px-4">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {t('admin.businesses.empty.title', 'Пока нет бизнесов')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t('admin.businesses.empty.description', 'Создайте первый бизнес, чтобы начать работу')}
                    </p>
                    <Link
                        href="/admin/businesses/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('admin.businesses.create', 'Создать бизнес')}
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {(list ?? []).map((b: Biz) => {
                        const ownerName = b.owner_id ? ownersMap.get(b.owner_id) ?? '—' : '—';
                        const branches = branchesCount.get(b.id) || 0;
                        const staff = staffCount.get(b.id) || 0;
                        const isApproved = b.is_approved === true;
                        const categories = b.categories || [];

                        return (
                            <div
                                key={b.id}
                                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200"
                            >
                                {/* Заголовок с статусом */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                            {b.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                            {b.slug}
                                        </p>
                                    </div>
                                    {isApproved ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            {t('admin.businesses.status.approved', 'Одобрен')}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                            </svg>
                                            {t('admin.businesses.status.moderation', 'На модерации')}
                                        </span>
                                    )}
                                </div>

                                {/* Категории */}
                                {categories.length > 0 && (
                                    <div className="mb-4">
                                        <div className="flex flex-wrap gap-1">
                                            {categories.slice(0, 3).map((cat) => (
                                                <span
                                                    key={cat}
                                                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300"
                                                >
                                                    {cat}
                                                </span>
                                            ))}
                                            {categories.length > 3 && (
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                                    +{categories.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Адрес */}
                                {b.address && (
                                    <div className="mb-4 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="line-clamp-1">{b.address}</span>
                                    </div>
                                )}

                                {/* Статистика */}
                                <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        <span className="font-medium">{branches}</span>
                                        <span className="text-xs">{t('admin.businesses.stats.branches', 'филиалов')}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        <span className="font-medium">{staff}</span>
                                        <span className="text-xs">{t('admin.businesses.stats.staff', 'сотрудников')}</span>
                                    </div>
                                </div>

                                {/* Владелец */}
                                <div className="mb-4 text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">{t('admin.businesses.owner.label', 'Владелец')}: </span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                        {ownerName}
                                    </span>
                                </div>

                                {/* Дата создания */}
                                <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                                    {t('admin.businesses.created', 'Создан')}: {new Date(b.created_at).toLocaleDateString('ru-RU', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </div>

                                {/* Действия */}
                                <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <Link
                                        href={`/admin/businesses/${b.id}`}
                                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:shadow-md transition-all duration-200 text-sm font-medium"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        {t('admin.businesses.open', 'Открыть')}
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
