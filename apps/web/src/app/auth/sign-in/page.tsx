import {Suspense} from 'react';

import SignInPage from "@/app/auth/sign-in/SignInPage";

export default function Page() {
    return (
        <Suspense fallback={<div className="text-sm text-gray-400">Загружаем…</div>}>
            <SignInPage/>
        </Suspense>
    );
}