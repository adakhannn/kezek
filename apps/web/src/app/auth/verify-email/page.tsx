import {Suspense} from 'react';

import VerifyEmailPage from "@/app/auth/verify-email/VerifyEmailPage";

export default function Page() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Загрузка…</div>
                </div>
            </main>
        }>
            <VerifyEmailPage/>
        </Suspense>
    );
}