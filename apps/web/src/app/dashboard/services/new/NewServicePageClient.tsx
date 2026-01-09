'use client';

import ServiceForm from '../ServiceForm';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function NewServicePageClient({ branches }: { branches: { id: string; name: string }[] }) {
    const { t } = useLanguage();

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">
                {t('services.form.titleNew', 'Новая услуга')}
            </h1>
            <ServiceForm
                initial={{
                    name_ru: '',
                    name_ky: null,
                    name_en: null,
                    duration_min: 60,
                    price_from: 0,
                    price_to: 0,
                    active: true,
                    branch_id: '',
                    branch_ids: [],
                }}
                branches={branches}
                apiBase="/api/services"
            />
        </main>
    );
}

