import {Suspense} from 'react';

import VerifyEmailPage from "@/app/auth/verify-email/VerifyEmailPage";

export default function Page() {
    return (
        <Suspense fallback={<div className="text-sm text-gray-400">Загружаем…</div>}>
            <VerifyEmailPage/>
        </Suspense>
    );
}