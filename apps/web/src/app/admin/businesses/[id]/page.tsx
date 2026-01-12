import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { DeleteBizButton } from '@/components/admin/DeleteBizButton';

export const dynamic = 'force-dynamic';

type BizRow = {
    id: string;
    name: string;
    slug: string;
    categories: string[] | null;
    owner_id: string | null;
    is_approved: boolean | null;
    created_at: string | null;
    address: string | null;
    phones: string[] | null;
};

type OwnerMini = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name?: string | null;
};

type RouteParams = { id: string };

export default async function BizPage({ params }: { params: Promise<RouteParams> }) {
    const { id } = await params;

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const cookieStore = await cookies();
    const supa = createServerClient(URL, ANON, {
        cookies: {
            get: (n: string) => cookieStore.get(n)?.value,
            set: () => {},
            remove: () => {},
        },
    });

    // 1) auth
    const {
        data: { user },
    } = await supa.auth.getUser();
    if (!user) return <div className="p-4">Не авторизован</div>;

    // 2) super-admin check
    const { data: isSuper, error: eSuper } = await supa.rpc('is_super_admin');
    if (eSuper) return <div className="p-4">Ошибка: {eSuper.message}</div>;
    if (!isSuper) return <div className="p-4">Нет доступа</div>;

    // 3) service client
    const admin = createClient(URL, SERVICE);

    // 4) бизнес с дополнительными полями
    const { data: biz, error: eBiz } = await admin
        .from('businesses')
        .select('id,name,slug,categories,owner_id,is_approved,created_at,address,phones')
        .eq('id', id)
        .maybeSingle<BizRow>();

    if (eBiz) return <div className="p-4">Ошибка: {eBiz.message}</div>;
    if (!biz) return <div className="p-4">Бизнес не найден</div>;

    // 5) краткая инфа о владельце
    let owner: OwnerMini | null = null;
    if (biz.owner_id) {
        const { data, error } = await admin.auth.admin.getUserById(biz.owner_id);
        if (!error && data?.user) {
            const meta = (data.user.user_metadata ?? {}) as Partial<{ full_name: string }>;
            owner = {
                id: data.user.id,
                email: data.user.email ?? null,
                phone: (data.user as { phone?: string | null }).phone ?? null,
                full_name: meta.full_name ?? null,
            };
        }
    }

    // 6) Статистика
    const [branchesData, staffData, servicesData, bookingsData] = await Promise.all([
        admin
            .from('branches')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', id),
        admin
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', id),
        admin
            .from('services')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', id),
        admin
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', id),
    ]);

    const branchesCount = branchesData.count || 0;
    const staffCount = staffData.count || 0;
    const servicesCount = servicesData.count || 0;
    const bookingsCount = bookingsData.count || 0;

    const categories = Array.isArray(biz.categories) ? biz.categories : [];
    const isApproved = biz.is_approved === true;

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                {biz.name}
                            </h1>
                            {isApproved ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Одобрен
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    На модерации
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                            {biz.slug}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/admin/businesses"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            К списку
                        </Link>
                        <Link
                            href={`/admin/businesses/${biz.id}/branches`}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            Филиалы
                        </Link>
                        {!biz.owner_id ? (
                            <Link
                                href={`/admin/businesses/${biz.id}/owner`}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Назначить владельца
                            </Link>
                        ) : (
                            <Link
                                href={`/admin/businesses/${biz.id}/owner`}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Редактировать владельца
                            </Link>
                        )}
                        <Link
                            href={`/admin/businesses/${biz.id}/members`}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Участники
                        </Link>
                    </div>
                </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{branchesCount}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Филиалов</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                            <svg className="w-5 h-5 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{staffCount}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Сотрудников</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{servicesCount}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Услуг</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{bookingsCount}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Бронирований</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Основная информация */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="p-2 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-lg">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Основная информация</h2>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Slug (URL)</label>
                            <div className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                /b/{biz.slug}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Категории</label>
                            {categories.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {categories.map((cat) => (
                                        <span
                                            key={cat}
                                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                                        >
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Категории не указаны</p>
                            )}
                        </div>
                        {biz.address && (
                            <div>
                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Адрес</label>
                                <div className="mt-1 flex items-start gap-2 text-sm text-gray-900 dark:text-gray-100">
                                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>{biz.address}</span>
                                </div>
                            </div>
                        )}
                        {biz.phones && biz.phones.length > 0 && (
                            <div>
                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Телефоны</label>
                                <div className="mt-1 space-y-1">
                                    {biz.phones.map((phone, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            <span>{phone}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {biz.created_at && (
                            <div>
                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Дата создания</label>
                                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                                    {new Date(biz.created_at).toLocaleDateString('ru-RU', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </p>
                            </div>
                        )}
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Адреса указываются в филиалах. Перейдите в раздел «Филиалы», чтобы добавить адрес(а).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Владелец */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="p-2 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-lg">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Владелец</h2>
                    </div>
                    {owner ? (
                        <div className="space-y-4">
                            {owner.full_name && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Имя</label>
                                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{owner.full_name}</p>
                                </div>
                            )}
                            <div>
                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">ID пользователя</label>
                                <div className="mt-1 font-mono text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700 break-all">
                                    {owner.id}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                                    {owner.email ? (
                                        <a href={`mailto:${owner.email}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                            {owner.email}
                                        </a>
                                    ) : (
                                        <span className="text-gray-500 dark:text-gray-400">—</span>
                                    )}
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Телефон</label>
                                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                                    {owner.phone ? (
                                        <a href={`tel:${owner.phone}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                            {owner.phone}
                                        </a>
                                    ) : (
                                        <span className="text-gray-500 dark:text-gray-400">—</span>
                                    )}
                                </p>
                            </div>
                            <div className="pt-2">
                                <Link
                                    href={`/admin/businesses/${biz.id}/owner`}
                                    className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Редактировать владельца
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Владелец не назначен
                            </p>
                            <Link
                                href={`/admin/businesses/${biz.id}/owner`}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 text-sm font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Назначить владельца
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Опасная зона */}
            <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 shadow-lg border-2 border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-red-900 dark:text-red-300">Опасная зона</h2>
                </div>
                <p className="text-sm text-red-800 dark:text-red-400 mb-4">
                    Удаление безвозвратно удалит записи, сотрудников, услуги, часы работы и роли, связанные с бизнесом.
                </p>
                <DeleteBizButton bizId={biz.id} bizName={biz.name} />
            </div>
        </div>
    );
}
