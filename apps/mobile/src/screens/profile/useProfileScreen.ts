import { Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../contexts/ToastContext';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';

import {
    buildProfileUpdatePayload,
    getProfileFormState,
    validateProfileForm,
} from './helpers';
import type { ProfileFormState, Profile } from './types';

export function useProfileScreen() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [formState, setFormState] = useState<ProfileFormState>({
        fullName: '',
        phone: '',
        notifyEmail: true,
        notifyWhatsApp: true,
    });

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        },
    });

    const { data: profile, isLoading } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;

            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, phone, email, notify_email, notify_whatsapp')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            return data as Profile;
        },
        enabled: !!user?.id,
    });

    useEffect(() => {
        setFormState(getProfileFormState(profile));
    }, [profile]);

    const updateProfileMutation = useMutation({
        mutationFn: async (state: ProfileFormState) => {
            return apiRequest('/profile/update', {
                method: 'POST',
                body: JSON.stringify(buildProfileUpdatePayload(state)),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
            showToast('РџСЂРѕС„РёР»СЊ РѕР±РЅРѕРІР»РµРЅ', 'success');
        },
        onError: (error: Error) => {
            showToast(error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РїСЂРѕС„РёР»СЊ', 'error');
        },
    });

    const handleSave = () => {
        const validationError = validateProfileForm(formState);
        if (validationError) {
            showToast(validationError, 'error');
            return;
        }

        updateProfileMutation.mutate(formState);
    };

    const handleSignOut = async () => {
        Alert.alert('Р’С‹С…РѕРґ', 'Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ РІС‹Р№С‚Рё?', [
            { text: 'РћС‚РјРµРЅР°', style: 'cancel' },
            {
                text: 'Р’С‹Р№С‚Рё',
                style: 'destructive',
                onPress: async () => {
                    await supabase.auth.signOut();
                },
            },
        ]);
    };

    return {
        user,
        isLoading,
        fullName: formState.fullName,
        phone: formState.phone,
        notifyEmail: formState.notifyEmail,
        notifyWhatsApp: formState.notifyWhatsApp,
        isSaving: updateProfileMutation.isPending,
        setFullName: (fullName: string) => setFormState((current) => ({ ...current, fullName })),
        setPhone: (phone: string) => setFormState((current) => ({ ...current, phone })),
        setNotifyEmail: (notifyEmail: boolean) => setFormState((current) => ({ ...current, notifyEmail })),
        setNotifyWhatsApp: (notifyWhatsApp: boolean) => setFormState((current) => ({ ...current, notifyWhatsApp })),
        handleSave,
        handleSignOut,
    };
}
