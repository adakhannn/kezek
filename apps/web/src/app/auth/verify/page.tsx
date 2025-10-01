import {Suspense} from 'react';

import VerifyPage from "@/app/auth/verify/VerifyPage";

export default function Page() {
    return (
        <Suspense fallback={<div className="text-sm text-gray-400">Загружаем…</div>}>
            <VerifyPage/>
        </Suspense>
    );
}