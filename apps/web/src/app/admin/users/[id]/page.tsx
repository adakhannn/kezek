import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getT } from '@/app/_components/i18n/server';
import { AdminEntityFlowTabs } from '@/app/admin/_components/AdminEntityFlowTabs';
import { UserBasicForm } from '@/components/admin/users/UserBasicForm';
import { UserPageRedirect } from '@/components/admin/users/UserPageRedirect';
import { UserSecurityActions } from '@/components/admin/users/UserSecurityActions';
import { AlertBanner } from '@/components/ui/AlertBanner';

export const dynamic = 'force-dynamic';

type Biz = { id: string; name: string; slug: string | null };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const t = getT('ru');

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const cookieStore = await cookies();

    const supa = createServerClient(URL, ANON, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    const { data: { user } } = await supa.auth.getUser();
    if (!user) return <div className="p-4">{t('admin.error.unauthorized', 'Unauthorized')}</div>;

    const { data: superRow, error: superErr } = await supa
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    if (superErr) return <div className="p-4">{t('admin.error.load', 'Load error')}: {superErr.message}</div>;
    if (!superRow) return <div className="p-4">{t('admin.noAccess.title', 'No access')}</div>;

    const admin = createClient(URL, SERVICE);

    const { data: got, error: eGet } = await admin.auth.admin.getUserById(id);
    if (eGet) return <div className="p-4">Load error: {eGet.message}</div>;
    const u = got?.user;
    if (!u) {
        redirect('/admin/users');
    }

    const userMeta = (u.user_metadata ?? {}) as Partial<{ full_name: string }>;

    const { data: suRow } = await admin
        .from('user_roles_with_user')
        .select('user_id')
        .eq('user_id', id)
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();
    const isSuperUser = !!suRow;

    const { data: ownerBusinesses } = await admin
        .from('businesses')
        .select('id,name,slug')
        .eq('owner_id', id)
        .order('name')
        .returns<Biz[]>();

    const { data: viewRoles } = await admin
        .from('user_roles_with_user')
        .select('user_id,role_key,biz_id')
        .eq('user_id', id);

    const bizIds = Array.from(
        new Set((viewRoles ?? []).map(r => r.biz_id).filter(Boolean) as string[])
    );
    const bizMap = new Map<string, { name: string; slug: string | null }>();
    if (bizIds.length) {
        const { data: relBiz } = await admin
            .from('businesses')
            .select('id,name,slug')
            .in('id', bizIds)
            .returns<Biz[]>();
        (relBiz ?? []).forEach(b => bizMap.set(b.id, { name: b.name, slug: b.slug ?? null }));
    }

    const roleBadges = (viewRoles ?? [])
        .filter(r => r.role_key !== 'super_admin' && r.role_key !== 'owner')
        .map((r, idx) => {
            const b = r.biz_id ? bizMap.get(r.biz_id) : null;
            return (
                <span
                    key={`${r.role_key}:${r.biz_id ?? 'global'}:${idx}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800"
                    title={r.biz_id ? (b ? `${b.name} (${b.slug ?? '—'})` : r.biz_id) : t('admin.users.role.global', 'Global role')}
                >
                    <span className="font-medium">{r.role_key}</span>
                    {r.biz_id && <span className="text-gray-500 dark:text-gray-400">/ {b?.name ?? r.biz_id}</span>}
                </span>
            );
        });

    const { data: susp } = await admin
        .from('user_suspensions')
        .select('user_id')
        .eq('user_id', id)
        .limit(1)
        .maybeSingle();
    const isBlocked = !!susp;

    const { data: suspensionData } = await admin
        .from('user_suspensions')
        .select('reason, created_at')
        .eq('user_id', id)
        .maybeSingle();

    return (
        <>
            <UserPageRedirect userId={id} userExists={!!u} />
            <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                        {userMeta.full_name || u.email || t('admin.users.user', 'User')}
                                    </h1>
                                    {isSuperUser && (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            {t('admin.users.superAdmin', 'Super Admin')}
                                        </span>
                                    )}
                                    {isBlocked && (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                                            </svg>
                                            {t('admin.users.blocked', 'Blocked')}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                    {u.email && (
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            {u.email}
                                        </div>
                                    )}
                                    {(u as { phone?: string | null }).phone && (
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            {(u as { phone?: string | null }).phone}
                                        </div>
                                    )}
                                    {u.last_sign_in_at && (
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {t('admin.users.lastSignIn', 'Last sign in')}: {new Date(u.last_sign_in_at).toLocaleString('ru-RU')}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Link href="/admin/users">
                                <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    {t('admin.users.backToList', 'Back to list')}
                                </button>
                            </Link>
                        </div>
                    </section>

                    <AdminEntityFlowTabs entity="users" detailHref={`/admin/users/${id}`} className="max-w-3xl" />

                    {isBlocked && suspensionData ? (
                        <AlertBanner
                            variant="danger"
                            title={t('admin.users.blocked.title')}
                            message={[
                                suspensionData.reason ? t('admin.users.blocked.reason') + ': ' + suspensionData.reason : null,
                                suspensionData.created_at
                                    ? t('admin.users.blocked.date') + ': ' + new Date(suspensionData.created_at).toLocaleString('ru-RU')
                                    : null,
                            ].filter(Boolean).join(' • ')}
                        />
                    ) : null}

                    <section className="grid gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                                <UserBasicForm
                                    userId={id}
                                    initial={{
                                        full_name: userMeta.full_name ?? '',
                                        email: u.email ?? '',
                                        phone: (u as { phone?: string | null }).phone ?? '',
                                    }}
                                />
                            </div>

                            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    {t('admin.users.businessOwner', 'Business owner')}
                                </h3>
                                {ownerBusinesses && ownerBusinesses.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {ownerBusinesses.map(b => (
                                            <Link
                                                key={b.id}
                                                href={`/admin/businesses/${b.id}`}
                                                className="p-4 bg-gradient-to-br from-indigo-50 to-pink-50 dark:from-indigo-900/20 dark:to-pink-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:shadow-md transition-all duration-200"
                                            >
                                                <div className="font-semibold text-indigo-900 dark:text-indigo-100 mb-1">
                                                    {b.name}
                                                </div>
                                                {b.slug && (
                                                    <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                                        @{b.slug}
                                                    </div>
                                                )}
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                                        {t('admin.users.noBusinessOwner', 'Not an owner of any business')}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    {t('admin.users.roles.title', 'User roles')}
                                </h3>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {roleBadges.length > 0 ? (
                                        roleBadges.map((badge, idx) => (
                                            <span key={idx} className="inline-block">
                                                {badge}
                                            </span>
                                        ))
                                    ) : (
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{t('admin.users.roles.empty', 'No roles')}</div>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                    {t('admin.users.roles.hint', 'Roles are assigned by business owners inside each business workspace.')}
                                </div>
                            </div>
                        </div>

                        <aside className="space-y-6">
                            <UserSecurityActions userId={id} isSuper={isSuperUser} isBlocked={isBlocked} />
                        </aside>
                    </section>
                </div>
            </main>
        </>
    );
}
