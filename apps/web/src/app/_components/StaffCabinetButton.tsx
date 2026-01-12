'use client';

import Link from 'next/link';

import { useLanguage } from './i18n/LanguageProvider';

export function StaffCabinetButton({ onClick }: { onClick?: () => void }) {
    const { t } = useLanguage();

    return (
        <Link 
            href="/staff" 
            onClick={onClick}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 text-sm"
        >
            {t('header.staffCabinet', 'Кабинет сотрудника')}
        </Link>
    );
}

