// app/auth/verify-otp/page.tsx
import {Suspense} from 'react';

import VerifyOtpPage from './VerifyOtpPage';

import { AuthPageLoading } from '@/app/auth/_components/AuthPageLoading';

export default function Page() {
    return (
        <Suspense fallback={<AuthPageLoading />}>
            <VerifyOtpPage/>
        </Suspense>
    );
}
