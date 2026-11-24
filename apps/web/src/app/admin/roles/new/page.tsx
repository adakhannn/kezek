// apps/web/src/app/admin/roles/new/page.tsx
import {headers} from 'next/headers';
import Link from 'next/link';

import { AdminEntityFlowTabs } from '../../_components/AdminEntityFlowTabs';

import RolesNewClient from './RolesNewClient';

import { getT } from '@/app/_components/i18n/server';
import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';

export default async function NewRolePage() {

    const supa = await createSupabaseServerClient();
    const t = await getT();

    const { data: { user }, error: authError } = await supa.auth.getUser();
    if (authError || !user) {
        return (
            <main className="p-4 space-y-4">
                <h1 className="text-2xl font-semibold">{t('admin.roles.newRole', 'Новая роль')}</h1>
                <div>{t('admin.roles.notAuthorized', 'Не авторизован')}</div>
            </main>
        );
    }

    const { isSuperAdmin, error: roleErr } = await checkCurrentUserIsSuperAdmin(supa, user.id);

    if (roleErr || !isSuperAdmin) {
        return <div className="p-4">{t('admin.roles.noAccess', 'Нет доступа')}</div>;
    }

    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const host = h.get('x-forwarded-host') ?? h.get('host')!;
    const baseURL = `${proto}://${host}`;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Заголовок */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                {t('admin.roles.new.title', 'Создать роль')}
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {t('admin.roles.new.subtitle', 'Добавьте новую роль в систему')}
                            </p>
                        </div>
                        <Link href="/admin/roles">
                            <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                {t('admin.roles.backToList', 'К списку ролей')}
                            </button>
                        </Link>
                    </div>
                </section>

                <AdminEntityFlowTabs entity="roles" className="max-w-3xl" />

                <RolesNewClient baseURL={baseURL} />
            </div>
        </main>
    );
}
