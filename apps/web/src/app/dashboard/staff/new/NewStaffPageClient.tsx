'use client';

import NewFromUser from '../NewFromUser';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type Branch = { id: string; name: string };

export default function NewStaffPageClient({ branches }: { branches: Branch[] }) {
    const { t } = useLanguage();

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">{t('staff.new.title', 'Добавить сотрудника из пользователей')}</h1>
            <NewFromUser branches={branches} />
        </main>
    );
}

