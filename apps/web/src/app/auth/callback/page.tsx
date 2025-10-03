import {Suspense} from 'react';

import AuthCallbackPage from "@/app/auth/callback/AuthCallbackPage";

export default function Page() {
    return (
        <Suspense fallback={<div className="text-sm text-gray-400">Загружаем…</div>}>
            <AuthCallbackPage/>
        </Suspense>
    );
}