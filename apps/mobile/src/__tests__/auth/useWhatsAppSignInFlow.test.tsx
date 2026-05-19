import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useWhatsAppSignInFlow } from '../../screens/auth/hooks/useWhatsAppSignInFlow';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}));

function HookHost() {
    const { whatsAppMobileAuthEnabled, openWhatsAppSignIn } = useWhatsAppSignInFlow();
    return (
        <>
            <Text testID="wa-enabled">{String(whatsAppMobileAuthEnabled)}</Text>
            <Text testID="wa-open" onPress={openWhatsAppSignIn}>
                open
            </Text>
        </>
    );
}

describe('useWhatsAppSignInFlow', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
    });

    test('returns feature flag and navigates to WhatsApp screen', () => {
        render(<HookHost />);

        expect(screen.getByTestId('wa-enabled').props.children).toBe('true');
        fireEvent.press(screen.getByTestId('wa-open'));
        expect(mockNavigate).toHaveBeenCalledWith('WhatsApp');
    });
});

