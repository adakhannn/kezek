'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function BranchErrorDisplay({ error }: { error: string }) {
    const { t } = useLanguage();
    
    return (
        <main className="p-6 text-red-600 dark:text-red-400">
            {t('branches.error', 'Ошибка')}: {error}
        </main>
    );
}

