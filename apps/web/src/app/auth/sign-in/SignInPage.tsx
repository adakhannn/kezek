// apps/web/src/app/auth/sign-in/SignInPage.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { SignInPageView } from './SignInPageView';
import { useExistingSessionRedirect } from './useExistingSessionRedirect';
import { useSignInRedirectDecision } from './useSignInRedirectDecision';
import { useSignInSubmitActions } from './useSignInSubmitActions';

import {useLanguage} from '@/app/_components/i18n/LanguageProvider';

type Mode = 'phone' | 'email';

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

    const redirectParam = sp.get('redirect') || '/';
    const {t} = useLanguage();
    // Временно отключен вход по телефону - используем только email
    const initialMode: Mode = 'email';

    const [mode] = useState<Mode>(initialMode); // Убрали setMode - режим фиксирован
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const whatsAppSignInEnabled = isWhatsAppWebSignInEnabled();

    const { decideAndGo } = useSignInRedirectDecision({ router });

    useExistingSessionRedirect({ redirectParam, decideAndGo });

    const {
        handleTelegramError,
        signInWithGoogle,
        signInWithYandex,
        sendOtp,
    } = useSignInSubmitActions({
        mode,
        phone,
        email,
        redirectParam,
        router,
        setSending,
        setError,
    });

    return (
        <SignInPageView
            t={t}
            mode={mode}
            phone={phone}
            email={email}
            sending={sending}
            error={error}
            redirectParam={redirectParam}
            setPhone={setPhone}
            setEmail={setEmail}
            sendOtp={sendOtp}
            signInWithGoogle={signInWithGoogle}
            signInWithYandex={signInWithYandex}
            handleTelegramError={handleTelegramError}
            whatsAppSignInEnabled={whatsAppSignInEnabled}
        />
    );
}


