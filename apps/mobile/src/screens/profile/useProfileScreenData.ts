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
import { PROFILE_WEB_PATH, TELEGRAM_LINK_WEB_PATH, openWebAsCurrentUser, webPageUrl } from '../../lib/webLinks';
import { fetchNotificationEmails, linkGoogleIdentity, unlinkLoginMethod } from './profileApi';
import {
    deriveLoginConnections,
    notificationEmailsBlockSave,
    selectedNotificationEmails,
    toggleNotificationEmail,
    type NotificationEmail,
    type SocialProvider,
} from './profileConnections';
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
    const [notifyTelegram, setNotifyTelegram] = useState(true);
    const [notificationEmails, setNotificationEmails] = useState<NotificationEmail[]>([]);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [connecting, setConnecting] = useState<SocialProvider | null>(null);
    const [unlinking, setUnlinking] = useState<SocialProvider | null>(null);
    const [telegramSheetOpen, setTelegramSheetOpen] = useState(false);

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
    const userId = userQuery.data?.id;

    const profileQuery = useQuery({
        queryKey: ['profile', userId],
        queryFn: async () => {
            if (!userId) return null;

            const { data, error } = await withProfileTimeout(
                supabase
                    .from('profiles')
                    .select(
                        'id, full_name, phone, notify_email, notify_whatsapp, notify_sms, notify_telegram, whatsapp_phone, whatsapp_verified, telegram_id, telegram_username, telegram_verified, yandex_id',
                    )
                    .eq('id', userId)
                    .maybeSingle(),
                'Profile data request timed out',
            );

            if (error) throw error;

            // New accounts may not have a row in `profiles` yet.
            // In that case we still render Profile screen with defaults
            // instead of showing a misleading network error state.
            if (!data) {
                return {
                    id: userId,
                    full_name: null,
                    phone: userQuery.data?.phone ?? null,
                    notify_email: true,
                    notify_whatsapp: true,
                    whatsapp_verified: false,
                } as Profile;
            }

            return data as Profile;
        },
        enabled: !!userId,
    });

    // The addresses for e-mail notifications (website: /api/profile/notification-emails). A failed
    // read leaves the list unknown: it is then neither sent nor required on save.
    const emailsQuery = useQuery({
        queryKey: ['notification-emails', userId],
        queryFn: fetchNotificationEmails,
        enabled: !!userId,
    });
    const emailsLoaded = emailsQuery.isSuccess;

    const connections = deriveLoginConnections(userQuery.data, profileQuery.data);
    // B5: WhatsApp notifications need a confirmed number; the switch is off and locked until then.
    const whatsappVerified = connections.whatsapp;
    // C12: linked as the web profile decides it (verified profile id, or the sign-in metadata).
    const telegramLinked = connections.telegram;
    const metadata = (userQuery.data?.user_metadata ?? {}) as { telegram_username?: unknown };
    const telegramUsername =
        profileQuery.data?.telegram_username ||
        (typeof metadata.telegram_username === 'string' ? metadata.telegram_username : null);

    useEffect(() => {
        if (!profileQuery.data) return;

        setFullName(profileQuery.data.full_name || '');
        setPhone(profileQuery.data.phone || '');
        setNotifyEmail(profileQuery.data.notify_email ?? true);
        setNotifyWhatsApp(profileQuery.data.notify_whatsapp ?? true);
        setNotifyTelegram(profileQuery.data.notify_telegram ?? true);
    }, [profileQuery.data]);

    useEffect(() => {
        if (emailsQuery.data) setNotificationEmails(emailsQuery.data);
    }, [emailsQuery.data]);

    const refreshAccount = async () => {
        await Promise.all([
            userQuery.refetch(),
            profileQuery.refetch(),
            emailsQuery.refetch(),
            queryClient.invalidateQueries({ queryKey: ['user-role'] }),
        ]);
    };

    const updateProfileMutation = useMutation({
        mutationFn: async () => {
            if (!userId) {
                throw new Error('Profile user is not loaded');
            }

            // Server endpoint applies the same rules as web (e.g. WhatsApp/Telegram
            // notifications only for verified channels) and mirrors the name to
            // Auth metadata.
            await withProfileTimeout(
                apiRequest('/profile/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        full_name: fullName.trim() || null,
                        phone: phone.trim() || null,
                        notify_email: notifyEmail,
                        notify_whatsapp: whatsappVerified && notifyWhatsApp,
                        notify_sms: profileQuery.data?.notify_sms ?? true,
                        notify_telegram: telegramLinked && notifyTelegram,
                        ...(emailsLoaded ? { notification_emails: selectedNotificationEmails(notificationEmails) } : {}),
                    }),
                }),
                'Profile update request timed out',
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile', userId] });
            queryClient.invalidateQueries({ queryKey: ['notification-emails', userId] });
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

        if (notificationEmailsBlockSave(notifyEmail, emailsLoaded, notificationEmails)) {
            showToast(t('parity.notifications.emailRequired'), 'error');
            return;
        }

        updateProfileMutation.mutate();
    };

    const openWeb = async (path: string) => {
        try {
            await openWebAsCurrentUser(path);
        } catch {
            showToast(t('cabinet.profile.account.openError'), 'error');
        }
    };

    const connect = async (provider: Exclude<SocialProvider, 'whatsapp'>) => {
        if (connecting) return;
        if (provider === 'telegram') {
            setTelegramSheetOpen(true);
            return;
        }
        if (provider === 'yandex') {
            // Yandex linking keeps its OAuth state in a browser cookie: it runs on the website.
            setConnecting('yandex');
            try {
                await openWeb(PROFILE_WEB_PATH);
                showToast(t('parity.connections.yandexWebOpened'), 'info');
            } finally {
                setConnecting(null);
            }
            return;
        }
        setConnecting('google');
        try {
            const result = await linkGoogleIdentity();
            if (result === 'linked') {
                await refreshAccount();
                showToast(t('parity.connections.linked'), 'success');
            }
        } catch (error) {
            showToast(getErrorMessage(error, t('parity.connections.googleLinkError'), t), 'error');
        } finally {
            setConnecting(null);
        }
    };

    const unlink = async (provider: SocialProvider, label: string) => {
        if (unlinking) return;
        const proceed = await confirm({
            title: t('parity.connections.unlinkTitle', { provider: label }),
            message: t('parity.connections.unlinkConfirm'),
            confirmLabel: t('parity.connections.unlink'),
            cancelLabel: t('cabinet.ui.cancel'),
            variant: 'danger',
        });
        if (!proceed) return;
        setUnlinking(provider);
        try {
            await unlinkLoginMethod(provider);
            await refreshAccount();
            showToast(t('parity.connections.unlinked', { provider: label }), 'success');
        } catch (error) {
            showToast(getErrorMessage(error, t('parity.connections.unlinkError', { provider: label }), t), 'error');
        } finally {
            setUnlinking(null);
        }
    };

    const openWebPage = async (path: '/privacy' | '/terms') => {
        try {
            await Linking.openURL(webPageUrl(path));
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
        isLoading: userQuery.isLoading || (!!userId && profileQuery.isLoading),
        loadError: (userQuery.error as Error | null) ?? (profileQuery.error as Error | null),
        retryLoad: refreshAccount,
        fullName,
        setFullName,
        phone,
        setPhone,
        notifyEmail,
        setNotifyEmail,
        notifyWhatsApp: whatsappVerified && notifyWhatsApp,
        setNotifyWhatsApp,
        notifyTelegram: telegramLinked && notifyTelegram,
        setNotifyTelegram,
        notificationEmails,
        notificationEmailsState: emailsLoaded ? 'ready' as const : emailsQuery.isError ? 'error' as const : 'loading' as const,
        toggleNotificationEmail: (email: string, enabled: boolean) =>
            setNotificationEmails((current) => toggleNotificationEmail(current, email, enabled)),
        retryNotificationEmails: () => void emailsQuery.refetch(),
        connections,
        connecting,
        unlinking,
        connect: (provider: Exclude<SocialProvider, 'whatsapp'>) => void connect(provider),
        unlink: (provider: SocialProvider, label: string) => void unlink(provider, label),
        telegramSheetOpen,
        closeTelegramSheet: () => setTelegramSheetOpen(false),
        onTelegramLinked: () => {
            setTelegramSheetOpen(false);
            showToast(t('parity.telegramLink.connected'), 'success');
            void refreshAccount();
        },
        // The bot link is not enabled on the server: the website's Telegram widget links instead.
        onTelegramUnavailable: () => {
            setTelegramSheetOpen(false);
            void openWeb(TELEGRAM_LINK_WEB_PATH);
        },
        whatsappVerified,
        whatsappPhone: profileQuery.data?.whatsapp_phone ?? null,
        onWhatsAppVerified: () => {
            void queryClient.invalidateQueries({ queryKey: ['profile', userId] });
        },
        telegramLinked,
        telegramUsername,
        isRefreshing: userQuery.isRefetching || profileQuery.isRefetching,
        saveProfile,
        confirmSignOut,
        openPrivacy: () => void openWebPage('/privacy'),
        openTerms: () => void openWebPage('/terms'),
        isSaving: updateProfileMutation.isPending,
        isSigningOut,
    };
}

export type ProfileScreenData = ReturnType<typeof useProfileScreenData>;
