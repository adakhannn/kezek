import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Linking } from 'react-native';

import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { apiRequest } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { TimeoutError } from '../../lib/fetchWithTimeout';
import { countPendingShiftOperations, signOutConfirmationText, signOutSafely } from '../../lib/signOut';
import { supabase } from '../../lib/supabase';
import { ACCOUNT_DELETION_WEB_PATH, TELEGRAM_LINK_WEB_PATH, openWebAsCurrentUser, webPageUrl } from '../../lib/webLinks';
import type { Profile } from './types';

const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/;
const PROFILE_QUERY_TIMEOUT_MS = 10000;

function withProfileTimeout<T>(operation: PromiseLike<T>, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new TimeoutError(message)), PROFILE_QUERY_TIMEOUT_MS);
    });

    return Promise.race([Promise.resolve(operation), timeout]).finally(() => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
}

export function useProfileScreenData() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const { t } = useLanguage();
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [notifyEmail, setNotifyEmail] = useState(true);
    const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const userQuery = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const {
                data: { user },
                error,
            } = await withProfileTimeout(
                supabase.auth.getUser(),
                'Profile user request timed out',
            );
            if (error) throw error;
            return user;
        },
    });

    const profileQuery = useQuery({
        queryKey: ['profile', userQuery.data?.id],
        queryFn: async () => {
            if (!userQuery.data?.id) return null;

            const { data, error } = await withProfileTimeout(
                supabase
                    .from('profiles')
                    .select(
                        'id, full_name, phone, notify_email, notify_whatsapp, notify_sms, notify_telegram, whatsapp_phone, whatsapp_verified, telegram_id, telegram_username, telegram_verified',
                    )
                    .eq('id', userQuery.data.id)
                    .maybeSingle(),
                'Profile data request timed out',
            );

            if (error) throw error;

            // New accounts may not have a row in `profiles` yet.
            // In that case we still render Profile screen with defaults
            // instead of showing a misleading network error state.
            if (!data) {
                return {
                    id: userQuery.data.id,
                    full_name: null,
                    phone: userQuery.data.phone ?? null,
                    notify_email: true,
                    notify_whatsapp: true,
                    whatsapp_verified: false,
                } as Profile;
            }

            return data as Profile;
        },
        enabled: !!userQuery.data?.id,
    });

    useEffect(() => {
        if (!profileQuery.data) return;

        setFullName(profileQuery.data.full_name || '');
        setPhone(profileQuery.data.phone || '');
        setNotifyEmail(profileQuery.data.notify_email ?? true);
        setNotifyWhatsApp(profileQuery.data.notify_whatsapp ?? true);
    }, [profileQuery.data]);

    const updateProfileMutation = useMutation({
        mutationFn: async () => {
            if (!userQuery.data?.id) {
                throw new Error('Profile user is not loaded');
            }

            // Server endpoint applies the same rules as web (e.g. WhatsApp/Telegram
            // notifications only for verified channels) and mirrors the name to
            // Auth metadata. Channels not edited here are sent back unchanged.
            await withProfileTimeout(
                apiRequest('/profile/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        full_name: fullName.trim() || null,
                        phone: phone.trim() || null,
                        notify_email: notifyEmail,
                        notify_whatsapp: whatsappVerified && notifyWhatsApp,
                        notify_sms: profileQuery.data?.notify_sms ?? true,
                        notify_telegram: profileQuery.data?.notify_telegram ?? true,
                    }),
                }),
                'Profile update request timed out',
            );

            return {
                ok: true,
                data: {
                    full_name: fullName.trim() || null,
                    phone: phone.trim() || null,
                    notify_email: notifyEmail,
                    notify_whatsapp: notifyWhatsApp,
                },
            };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile', userQuery.data?.id] });
            showToast(t('cabinet.profile.saved'), 'success');
        },
        onError: (error: Error) => {
            showToast(
                getErrorMessage(error, t('cabinet.profile.saveError'), t),
                'error',
            );
        },
    });

    const saveProfile = () => {
        if (!fullName.trim()) {
            showToast(t('cabinet.profile.nameRequired'), 'error');
            return;
        }

        const trimmedPhone = phone.trim();
        if (trimmedPhone && !PHONE_PATTERN.test(trimmedPhone)) {
            showToast(t('cabinet.profile.phoneInvalid'), 'error');
            return;
        }

        updateProfileMutation.mutate();
    };

    // B5: WhatsApp notifications need a confirmed number; the switch is off and locked until then.
    const whatsappVerified = !!profileQuery.data?.whatsapp_verified;
    // C12: linked as the web profile decides it (verified profile id, or the sign-in metadata).
    const metadata = (userQuery.data?.user_metadata ?? {}) as { telegram_id?: unknown; telegram_username?: unknown };
    const telegramLinked =
        (!!profileQuery.data?.telegram_id && !!profileQuery.data?.telegram_verified) || !!metadata.telegram_id;
    const telegramUsername =
        profileQuery.data?.telegram_username ||
        (typeof metadata.telegram_username === 'string' ? metadata.telegram_username : null);

    const linkTelegram = async () => {
        try {
            await openWebAsCurrentUser(TELEGRAM_LINK_WEB_PATH);
        } catch {
            showToast(t('cabinet.profile.account.openError'), 'error');
        }
    };

    const openWebPage = async (path: '/privacy' | '/terms') => {
        try {
            await Linking.openURL(webPageUrl(path));
        } catch {
            showToast(t('cabinet.profile.account.openError'), 'error');
        }
    };

    // App Store 5.1.1(v) / Google Play: deletion starts in the app. The web profile already runs
    // the whole flow (blockers, confirmation, cancellation), so the app opens it signed in.
    const deleteAccount = async () => {
        const proceed = await confirm({
            title: t('cabinet.profile.account.deleteConfirmTitle'),
            message: t('cabinet.profile.account.deleteConfirmMessage'),
            confirmLabel: t('cabinet.profile.account.deleteConfirm'),
            cancelLabel: t('cabinet.ui.cancel'),
            variant: 'danger',
        });
        if (!proceed) return;
        try {
            await openWebAsCurrentUser(ACCOUNT_DELETION_WEB_PATH);
        } catch {
            showToast(t('cabinet.profile.account.openError'), 'error');
        }
    };

    const confirmSignOut = async () => {
        const text = signOutConfirmationText(await countPendingShiftOperations(), t);
        const shouldSignOut = await confirm({
            title: text.title,
            message: text.message,
            confirmLabel: text.confirmLabel,
            cancelLabel: t('cabinet.ui.cancel'),
            variant: 'danger',
        });

        if (!shouldSignOut) {
            return;
        }

        try {
            setIsSigningOut(true);
            await signOutSafely();

            showToast(t('cabinet.profile.signedOut'), 'success');
        } catch (error: unknown) {
            showToast(
                getErrorMessage(error, t('cabinet.profile.signOutError'), t),
                'error',
            );
        } finally {
            setIsSigningOut(false);
        }
    };

    return {
        user: userQuery.data,
        profile: profileQuery.data,
        isLoading: userQuery.isLoading || (!!userQuery.data?.id && profileQuery.isLoading),
        loadError: (userQuery.error as Error | null) ?? (profileQuery.error as Error | null),
        retryLoad: async () => {
            await Promise.all([userQuery.refetch(), profileQuery.refetch()]);
        },
        fullName,
        setFullName,
        phone,
        setPhone,
        notifyEmail,
        setNotifyEmail,
        notifyWhatsApp: whatsappVerified && notifyWhatsApp,
        setNotifyWhatsApp,
        whatsappVerified,
        whatsappPhone: profileQuery.data?.whatsapp_phone ?? null,
        onWhatsAppVerified: () => {
            void queryClient.invalidateQueries({ queryKey: ['profile', userQuery.data?.id] });
        },
        telegramLinked,
        telegramUsername,
        linkTelegram: () => void linkTelegram(),
        isRefreshing: userQuery.isRefetching || profileQuery.isRefetching,
        saveProfile,
        confirmSignOut,
        openPrivacy: () => void openWebPage('/privacy'),
        openTerms: () => void openWebPage('/terms'),
        deleteAccount: () => void deleteAccount(),
        isSaving: updateProfileMutation.isPending,
        isSigningOut,
    };
}


