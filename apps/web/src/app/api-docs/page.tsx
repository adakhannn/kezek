'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { logError } from '@/lib/log';
import { loadOpenApiDocument } from '@/lib/openApiDocument';

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
        const controller = new AbortController();
        let active = true;
        loadOpenApiDocument(controller.signal)
            .then((document) => {
                if (active) setSpec(document);
            })
            .catch((error: unknown) => {
                if (active) logError('ApiDocs', 'Failed to load OpenAPI document', error);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
            controller.abort();
        };
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
            <SwaggerUI spec={spec} supportedSubmitMethods={[]} />
        </div>
    );
}

