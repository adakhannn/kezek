import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { Profile } from './types';

export function useProfileScreenData() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [notifyEmail, setNotifyEmail] = useState(true);
    const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);

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
                .select('id, full_name, phone, email, notify_email, notify_whatsapp')
                .eq('id', userQuery.data.id)
                .single();

            if (error) throw error;
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

        await supabase.auth.signOut();
    };

    return {
        user: userQuery.data,
        profile: profileQuery.data,
        isLoading: profileQuery.isLoading,
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
    };
}

