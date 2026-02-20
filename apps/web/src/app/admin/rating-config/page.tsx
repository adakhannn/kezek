// apps/web/src/app/admin/rating-config/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RatingConfigClient } from './RatingConfigClient';

import { getT } from '@/app/_components/i18n/server';


export const dynamic = 'force-dynamic';

type RatingConfig = {
    id: string;
    staff_reviews_weight: number;
    staff_productivity_weight: number;
    staff_loyalty_weight: number;
    staff_discipline_weight: number;
    window_days: number;
    is_active: boolean;
    valid_from: string;
    created_at: string;
    updated_at: string;
};

export default async function RatingConfigPage() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    });

    // 1) Авторизация
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/auth/sign-in?redirect=/admin/rating-config');

    // 2) Проверка супер-админа
    const { data: superRow, error: superErr } = await supabase
        .from('user_roles_with_user')
        .select('role_key,biz_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null)
        .limit(1)
        .maybeSingle();

    const t = getT('ru');
    
    if (superErr) {
        return (
            <main className="p-6">
                <div className="text-red-600">{t('admin.ratingConfig.error.load', 'Ошибка')}: {superErr.message}</div>
            </main>
        );
    }
    if (!superRow) {
        return (
            <main className="p-6">
                <div className="text-red-600">{t('admin.ratingConfig.noAccess', 'Нет доступа. Только суперадмин может управлять настройками рейтинга.')}</div>
            </main>
        );
    }

    // 3) Получаем текущую активную конфигурацию
    const { data: config, error: configError } = await supabase
        .from('rating_global_config')
        .select('*')
        .eq('is_active', true)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (configError) {
        return (
            <main className="p-6">
                <div className="text-red-600">{t('admin.ratingConfig.error.loadConfig', 'Ошибка загрузки конфигурации')}: {configError.message}</div>
            </main>
        );
    }

    const currentConfig: RatingConfig | null = config as RatingConfig | null;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Заголовок */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                Настройки рейтингов
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Управление глобальными настройками расчета рейтингов для всех бизнесов
                            </p>
                        </div>
                        <Link href="/admin">
                            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                В админку
                            </button>
                        </Link>
                    </div>
                </section>

                {/* Информация о текущей конфигурации */}
                {currentConfig && (
                    <section className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    Активная конфигурация
                                </p>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    Действует с {new Date(currentConfig.valid_from).toLocaleDateString('ru-RU', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* Форма редактирования */}
                <RatingConfigClient initialConfig={currentConfig} />
            </div>
        </main>
    );
}

