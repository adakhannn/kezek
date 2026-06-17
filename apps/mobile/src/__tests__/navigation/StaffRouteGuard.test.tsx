import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

import { useUserRole } from '../../hooks/useUserRole';
import { withStaffRouteGuard } from '../../navigation/StaffRouteGuard';

const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        replace: mockReplace,
    }),
}));

jest.mock('../../hooks/useUserRole', () => ({
    useUserRole: jest.fn(),
}));

const mockedUseUserRole = useUserRole as jest.MockedFunction<typeof useUserRole>;

function ProtectedScreen() {
    return <Text>Protected staff workspace</Text>;
}

const GuardedScreen = withStaffRouteGuard(ProtectedScreen);

describe('StaffRouteGuard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders the protected screen for staff users', () => {
        mockedUseUserRole.mockReturnValue({
            isOwner: false,
            isStaff: true,
            isSuperAdmin: false,
            isLoading: false,
            loadError: null,
        });

        render(<GuardedScreen />);

        expect(screen.getByText('Protected staff workspace')).toBeTruthy();
        expect(mockReplace).not.toHaveBeenCalled();
    });

    test('does not render protected content while role lookup is loading', () => {
        mockedUseUserRole.mockReturnValue({
            isOwner: false,
            isStaff: false,
            isSuperAdmin: false,
            isLoading: true,
            loadError: null,
        });

        render(<GuardedScreen />);

        expect(screen.getByText('Проверяем доступ...')).toBeTruthy();
        expect(screen.queryByText('Protected staff workspace')).toBeNull();
        expect(mockReplace).not.toHaveBeenCalled();
    });

    test('redirects non-staff users to Home without rendering protected content', async () => {
        mockedUseUserRole.mockReturnValue({
            isOwner: true,
            isStaff: false,
            isSuperAdmin: false,
            isLoading: false,
            loadError: null,
        });

        render(<GuardedScreen />);

        expect(screen.queryByText('Protected staff workspace')).toBeNull();
        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('Main', { screen: 'Home' });
        });
    });
});
