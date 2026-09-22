import {Suspense} from 'react';

import { AuthPageLoading } from '@/app/auth/_components/AuthPageLoading';
import VerifyPage from "@/app/auth/verify/VerifyPage";

export default function Page() {
    return (
        <Suspense fallback={<AuthPageLoading />}>
            <VerifyPage/>
        </Suspense>
    );
}
