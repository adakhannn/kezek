import { renderHook } from '@testing-library/react-native';
import { useNetworkState } from 'expo-network';

import { useNetworkStatus } from '../../hooks/useNetworkStatus';

jest.mock('expo-network', () => ({
    useNetworkState: jest.fn(),
}));

describe('useNetworkStatus', () => {
    const mockedUseNetworkState = useNetworkState as jest.Mock;

    afterEach(() => {
        mockedUseNetworkState.mockReset();
    });

    test('returns offline when disconnected', () => {
        mockedUseNetworkState.mockReturnValue({
            isConnected: false,
            isInternetReachable: false,
        });

        const { result } = renderHook(() => useNetworkStatus());

        expect(result.current.isConnected).toBe(false);
        expect(result.current.isInternetReachable).toBe(false);
        expect(result.current.isOffline).toBe(true);
    });

    test('returns offline when connected but internet is unreachable', () => {
        mockedUseNetworkState.mockReturnValue({
            isConnected: true,
            isInternetReachable: false,
        });

        const { result } = renderHook(() => useNetworkStatus());

        expect(result.current.isConnected).toBe(true);
        expect(result.current.isInternetReachable).toBe(false);
        expect(result.current.isOffline).toBe(true);
    });

    test('returns online only when connected and internet is reachable', () => {
        mockedUseNetworkState.mockReturnValue({
            isConnected: true,
            isInternetReachable: true,
        });

        const { result } = renderHook(() => useNetworkStatus());

        expect(result.current.isConnected).toBe(true);
        expect(result.current.isInternetReachable).toBe(true);
        expect(result.current.isOffline).toBe(false);
    });
});
