import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '../../../i18n';
import {
    appleFullNameToMetadata,
    isAppleSignInAvailable,
    isAppleSignInCancel,
    loadAppleAuthentication,
} from '../../../lib/appleAuth';
import { createAppleNonce } from '../../../lib/authCrypto';
import { getErrorMessage, getRawErrorMessage, isNetworkError } from '../../../lib/errors';
import { logError, logWarn } from '../../../lib/log';
import { supabase } from '../../../lib/supabase';
import { type AuthUiState, transitionAuthUiState } from './authUiState';

type ShowToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;

/**
 * Native Sign in with Apple (iOS only, App Store guideline 4.8). Apple's ID token goes to Supabase
 * Auth; the resulting session reaches the app through onAuthStateChange exactly like a Google one.
 */
export function useAppleSignInFlow({ showToast }: { showToast: ShowToast }) {
    const { t } = useLanguage();
    const [appleAvailable, setAppleAvailable] = useState(false);
    const [appleLoading, setAppleLoading] = useState(false);
    const [appleState, setAppleState] = useState<AuthUiState>('idle');

    useEffect(() => {
        let mounted = true;
        void isAppleSignInAvailable().then((available) => {
            if (mounted) setAppleAvailable(available);
        });
        return () => {
            mounted = false;
        };
    }, []);

    const handleAppleSignIn = useCallback(async () => {
        const AppleAuthentication = loadAppleAuthentication();
        if (!AppleAuthentication) return;

        setAppleLoading(true);
        setAppleState((prev) => transitionAuthUiState(prev, 'start'));
        try {
            const { rawNonce, hashedNonce } = await createAppleNonce();
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
                nonce: hashedNonce,
            });
            if (!credential.identityToken) {
                throw new Error('apple_identity_token_missing');
            }

            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'apple',
                token: credential.identityToken,
                nonce: rawNonce,
            });
            if (error) throw error;

            // Apple shares the name only on the first sign-in. Stored where Google puts it
            // (user_metadata.full_name): the display-name fallback for bookings and the business side.
            // Like a Google account, the profile name field stays empty until the user fills it in.
            const nameMetadata = appleFullNameToMetadata(credential.fullName);
            const existingName = data.user?.user_metadata?.full_name;
            if (nameMetadata && !(typeof existingName === 'string' && existingName.trim())) {
                const { error: updateError } = await supabase.auth.updateUser({ data: nameMetadata });
                if (updateError) {
                    logWarn('SignInScreen', 'Apple sign-in name was not saved', { error: updateError });
                }
            }

            setAppleState((prev) => transitionAuthUiState(prev, 'succeed'));
            showToast(t('auth.signedIn'), 'success');
        } catch (error: unknown) {
            if (isAppleSignInCancel(error)) {
                setAppleState((prev) => transitionAuthUiState(prev, 'cancel'));
                return;
            }
            logError('SignInScreen', 'Apple sign in error', { provider: 'apple', error });
            setAppleState((prev) => transitionAuthUiState(prev, 'fail'));
            // Only a lost connection or a timeout gets its own shared text; any Apple or Supabase message
            // (audience, nonce, native failure) is shown as the localized Apple sign-in error, never raw.
            const offline = isNetworkError(error) || /timed out|timeout/i.test(getRawErrorMessage(error));
            showToast(offline ? getErrorMessage(error, t('auth.apple.status.error'), t) : t('auth.apple.status.error'), 'error');
        } finally {
            setAppleLoading(false);
            setAppleState((prev) => transitionAuthUiState(prev, 'reset'));
        }
    }, [showToast, t]);

    return { appleAvailable, appleLoading, appleState, handleAppleSignIn };
}
