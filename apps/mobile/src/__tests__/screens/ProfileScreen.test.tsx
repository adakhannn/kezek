/**
 * Smoke test: ProfileScreen
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

import ProfileScreen from '../../screens/ProfileScreen';

jest.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: jest.fn(),
    }),
}));

jest.mock('../../screens/profile/useProfileScreen', () => ({
    useProfileScreen: () => ({
        user: {
            id: 'test-user-id',
            email: 'user@example.com',
        },
        isLoading: false,
        fullName: 'Алина',
        phone: '+996500000001',
        notifyEmail: true,
        notifyWhatsApp: false,
        isSaving: false,
        setFullName: jest.fn(),
        setPhone: jest.fn(),
        setNotifyEmail: jest.fn(),
        setNotifyWhatsApp: jest.fn(),
        handleSave: jest.fn(),
        handleSignOut: jest.fn(),
    }),
}));

describe('ProfileScreen', () => {
    test('renders profile header and loaded user data', () => {
        render(<ProfileScreen />);

        expect(screen.getByText('РџСЂРѕС„РёР»СЊ')).toBeTruthy();
        expect(screen.getByDisplayValue('Алина')).toBeTruthy();
        expect(screen.getByDisplayValue('+996500000001')).toBeTruthy();
        expect(screen.getByText('user@example.com')).toBeTruthy();
    });
});
