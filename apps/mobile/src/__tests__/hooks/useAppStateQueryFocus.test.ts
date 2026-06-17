import { focusManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';

import {
    syncQueryFocusWithAppState,
    useAppStateQueryFocus,
} from '../../hooks/useAppStateQueryFocus';

describe('useAppStateQueryFocus', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        focusManager.setFocused(undefined);
    });

    test('maps active state to focused and background states to unfocused', () => {
        const setFocused = jest.spyOn(focusManager, 'setFocused');

        syncQueryFocusWithAppState('background');
        syncQueryFocusWithAppState('inactive');
        syncQueryFocusWithAppState('active');

        expect(setFocused).toHaveBeenNthCalledWith(1, false);
        expect(setFocused).toHaveBeenNthCalledWith(2, false);
        expect(setFocused).toHaveBeenNthCalledWith(3, true);
    });

    test('subscribes to app-state changes and removes the listener', () => {
        let listener: ((state: 'active' | 'background') => void) | undefined;
        const remove = jest.fn();
        const setFocused = jest.spyOn(focusManager, 'setFocused');
        const addEventListener = jest
            .spyOn(AppState, 'addEventListener')
            .mockImplementation((_event, handler) => {
                listener = handler as typeof listener;
                return { remove } as ReturnType<typeof AppState.addEventListener>;
            });

        const { unmount } = renderHook(() => useAppStateQueryFocus());

        expect(addEventListener).toHaveBeenCalledWith('change', syncQueryFocusWithAppState);
        listener?.('background');
        listener?.('active');
        expect(setFocused).toHaveBeenCalledWith(false);
        expect(setFocused).toHaveBeenCalledWith(true);

        unmount();
        expect(remove).toHaveBeenCalledTimes(1);
    });

    test('refetches an active stale query after returning to foreground', async () => {
        const queryFn = jest
            .fn()
            .mockResolvedValueOnce('initial')
            .mockResolvedValueOnce('refreshed');
        const client = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    staleTime: 0,
                    refetchOnWindowFocus: true,
                },
            },
        });
        const observer = new QueryObserver(client, {
            queryKey: ['foreground-refresh'],
            queryFn,
        });

        client.mount();
        const unsubscribe = observer.subscribe(() => undefined);

        await waitFor(() => {
            expect(queryFn).toHaveBeenCalledTimes(1);
        });

        syncQueryFocusWithAppState('background');
        syncQueryFocusWithAppState('active');

        await waitFor(() => {
            expect(queryFn).toHaveBeenCalledTimes(2);
        });

        unsubscribe();
        client.unmount();
        client.clear();
    });
});
