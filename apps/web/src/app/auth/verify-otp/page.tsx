// app/auth/verify-otp/page.tsx
import {Suspense} from 'react';

import VerifyOtpPage from './VerifyOtpPage';

export default function Page() {
    return (
        <Suspense fallback={<div className="text-sm text-gray-400">Загружаем…</div>}>
            <VerifyOtpPage/>
        </Suspense>
    );
}
