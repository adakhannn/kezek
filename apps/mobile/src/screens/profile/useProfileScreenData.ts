import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { Profile } from './types';

const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/;

export function useProfileScreenData() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
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
            } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        },
    });

    const profileQuery = useQuery({
        queryKey: ['profile', userQuery.data?.id],
        queryFn: async () => {
            if (!userQuery.data?.id) return null;

            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, phone, notify_email, notify_whatsapp')
                .eq('id', userQuery.data.id)
                .maybeSingle();

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
            return apiRequest('/profile/update', {
                method: 'POST',
                body: JSON.stringify({
                    full_name: fullName.trim() || null,
                    phone: phone.trim() || null,
                    notify_email: notifyEmail,
                    notify_whatsapp: notifyWhatsApp,
                }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile', userQuery.data?.id] });
            showToast('Профиль обновлен', 'success');
        },
        onError: (error: Error) => {
            showToast(error.message || 'Не удалось обновить профиль', 'error');
        },
    });

    const saveProfile = () => {
        if (!fullName.trim()) {
            showToast('Введите имя', 'error');
            return;
        }

        const trimmedPhone = phone.trim();
        if (trimmedPhone && !PHONE_PATTERN.test(trimmedPhone)) {
            showToast('Введите корректный номер телефона', 'error');
            return;
        }

        updateProfileMutation.mutate();
    };

    const confirmSignOut = async () => {
        const shouldSignOut = await confirm({
            title: 'Выход',
            message: 'Вы уверены, что хотите выйти?',
            confirmLabel: 'Выйти',
            cancelLabel: 'Отмена',
            variant: 'danger',
        });

        if (!shouldSignOut) {
            return;
        }

        try {
            setIsSigningOut(true);
            const { error } = await supabase.auth.signOut();
            if (error) {
                throw error;
            }

            showToast('Вы вышли из аккаунта', 'success');
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : 'Не удалось выйти из аккаунта';
            showToast(message, 'error');
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
        notifyWhatsApp,
        setNotifyWhatsApp,
        saveProfile,
        confirmSignOut,
        isSaving: updateProfileMutation.isPending,
        isSigningOut,
    };
}


