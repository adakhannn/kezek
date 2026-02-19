'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import {logError} from '@/lib/log';

// Swagger UI — тяжёлая библиотека, загружаем её только на клиенте и только для этой страницы,
// чтобы не раздувать общий bundle и не мешать SSR.
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
    ssr: false,
});

// Стили остаются на уровне страницы, чтобы не попадать в основной CSS‑бандл приложения.
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocsPage() {
    const { t } = useLanguage();
    const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/swagger.json')
            .then((res) => res.json())
            .then((data) => {
                setSpec(data);
                setLoading(false);
            })
            .catch((err) => {
                logError('ApiDocs', 'Failed to load Swagger spec', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">{t('apiDocs.loading', 'Загрузка документации...')}</p>
                </div>
            </div>
        );
    }

    if (!spec) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-red-600 dark:text-red-400">{t('apiDocs.error.load', 'Не удалось загрузить документацию')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <SwaggerUI spec={spec} />
        </div>
    );
}

