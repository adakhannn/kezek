import type { Profile, ProfileFormState } from './types';

export function getProfileFormState(profile: Profile | null | undefined): ProfileFormState {
    return {
        fullName: profile?.full_name || '',
        phone: profile?.phone || '',
        notifyEmail: profile?.notify_email ?? true,
        notifyWhatsApp: profile?.notify_whatsapp ?? true,
    };
}

export function buildProfileUpdatePayload(state: ProfileFormState) {
    return {
        full_name: state.fullName.trim() || null,
        phone: state.phone.trim() || null,
        notify_email: state.notifyEmail,
        notify_whatsapp: state.notifyWhatsApp,
    };
}

export function validateProfileForm(state: ProfileFormState) {
    if (!state.fullName.trim()) {
        return 'Р’РІРµРґРёС‚Рµ РёРјСЏ';
    }

    return null;
}
