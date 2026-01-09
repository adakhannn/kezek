'use client';

import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function NotFoundMessage({ id }: { id: string }) {
    const { t } = useLanguage();

    return (
        <>
            <div className="text-red-500">
                {t('booking.notFound', 'Booking not found')}
            </div>
            <div className="text-sm text-gray-500">
                ID: {id}
            </div>
            <Link href="/" className="underline">
                {t('booking.goHome', 'Go to home')}
            </Link>
        </>
    );
}

