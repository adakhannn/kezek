// apps/web/src/app/auth/sign-in/SignInPage.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { SignInPageView } from './SignInPageView';
import { useExistingSessionRedirect } from './useExistingSessionRedirect';
import { useSignInRedirectDecision } from './useSignInRedirectDecision';
import { useSignInSubmitActions } from './useSignInSubmitActions';

import {useLanguage} from '@/app/_components/i18n/LanguageProvider';
import { getAuthReturnPath } from '@/lib/authReturnUrl';
import { getOAuthErrorMessage } from '@/lib/oauthErrorMessage';

function isWhatsAppWebSignInEnabled(): boolean {
    const raw = process.env.NEXT_PUBLIC_MOBILE_WHATSAPP_AUTH;
    if (!raw) return true;
    const normalized = raw.trim().toLowerCase();
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
    return true;
}

export default function SignInPage() {
    const sp = useSearchParams();
    const router = useRouter();

    const redirectParam = getAuthReturnPath(new URLSearchParams(sp.toString()));
    const {t} = useLanguage();
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(() =>
        getOAuthErrorMessage(sp.get('error')),
    );
    const whatsAppSignInEnabled = isWhatsAppWebSignInEnabled();

    const { decideAndGo } = useSignInRedirectDecision({ router });

    useExistingSessionRedirect({ redirectParam, decideAndGo });

    const {
        handleTelegramError,
        signInWithGoogle,
        signInWithYandex,
    } = useSignInSubmitActions({
        redirectParam,
        setSending,
        setError,
    });

    return (
        <SignInPageView
            t={t}
            sending={sending}
            error={error}
            redirectParam={redirectParam}
            signInWithGoogle={signInWithGoogle}
            signInWithYandex={signInWithYandex}
            handleTelegramError={handleTelegramError}
            whatsAppSignInEnabled={whatsAppSignInEnabled}
        />
    );
}


