'use client';

import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function BranchErrorDisplay() {
    const { t } = useLanguage();

    return (
        <main className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center p-6">
            <section className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
                <h1 className="text-xl font-semibold text-red-300">
                    {t('branches.error.loadTitle', 'Не удалось открыть филиал')}
                </h1>
                <p className="mt-2 text-sm text-slate-300">
                    {t('branches.error.loadDescription', 'Попробуйте обновить страницу. Если ошибка повторится, вернитесь к списку филиалов.')}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                    >
                        {t('branches.error.reload', 'Обновить страницу')}
                    </button>
                    <Link
                        href="/dashboard/branches"
                        className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:bg-slate-800"
                    >
                        {t('branches.error.backToList', 'К списку филиалов')}
                    </Link>
                </div>
            </section>
        </main>
    );
}

