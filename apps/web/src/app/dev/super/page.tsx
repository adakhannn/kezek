// apps/web/src/app/dev/super/page.tsx
'use client';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { supabase } from '@/lib/supabaseClient';

export default function DevSuper() {
    const { t } = useLanguage();
    const [msg, setMsg] = useState<string>('');

    async function becomeSuper() {
        const { error } = await supabase.rpc('dev_become_superadmin');
        setMsg(error 
            ? `${t('dev.super.error', 'Ошибка')}: ${error.message}` 
            : t('dev.super.success', 'Готово: вы супер-админ. Обновите страницу и откройте /dashboard/bookings'));
    }

    return (
        <main className="mx-auto max-w-md p-6 space-y-3">
            <h1 className="text-xl font-semibold">{t('dev.super.title', 'Dev: сделать себя супер-админом')}</h1>
            <button className="border px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={becomeSuper}>
                {t('dev.super.button', 'Стать супер-админом')}
            </button>
            {msg && <div className="text-sm text-gray-700 dark:text-gray-300">{msg}</div>}
        </main>
    );
}
