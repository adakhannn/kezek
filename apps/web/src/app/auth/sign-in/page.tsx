// apps/web/src/app/auth/sign-in/page.tsx
import { Suspense } from 'react';

import { AuthPageLoading } from '@/app/auth/_components/AuthPageLoading';
import SignInPage from '@/app/auth/sign-in/SignInPage';

export default function Page() {
    return (
        <Suspense fallback={<AuthPageLoading />}>
            <SignInPage />
        </Suspense>
    );
}
