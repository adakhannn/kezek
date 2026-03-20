import {
    buildProfileUpdatePayload,
    getProfileFormState,
    validateProfileForm,
} from '../../screens/profile/helpers';

describe('profile helpers', () => {
    test('maps profile data into form state with defaults', () => {
        expect(getProfileFormState(null)).toEqual({
            fullName: '',
            phone: '',
            notifyEmail: true,
            notifyWhatsApp: true,
        });

        expect(getProfileFormState({
            id: 'profile-1',
            full_name: 'РђР»РёРЅР°',
            phone: '+996500000001',
            email: 'a@example.com',
            notify_email: false,
            notify_whatsapp: true,
        })).toEqual({
            fullName: 'РђР»РёРЅР°',
            phone: '+996500000001',
            notifyEmail: false,
            notifyWhatsApp: true,
        });
    });

    test('builds normalized update payload and validates empty name', () => {
        const state = {
            fullName: '  РђР»РёРЅР°  ',
            phone: '  +996500000001  ',
            notifyEmail: true,
            notifyWhatsApp: false,
        };

        expect(buildProfileUpdatePayload(state)).toEqual({
            full_name: 'РђР»РёРЅР°',
            phone: '+996500000001',
            notify_email: true,
            notify_whatsapp: false,
        });

        expect(validateProfileForm(state)).toBeNull();
        expect(validateProfileForm({ ...state, fullName: '   ' })).toContain('Р’РІРµРґРёС‚Рµ');
    });
});
