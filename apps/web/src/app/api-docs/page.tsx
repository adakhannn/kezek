'use client';

import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

import {logError} from '@/lib/log';

export default function ApiDocsPage() {
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Загрузка документации...</p>
                </div>
            </div>
        );
    }

    if (!spec) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-red-600">Не удалось загрузить документацию</p>
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

