import { useEffect } from 'react';
import { focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

export function syncQueryFocusWithAppState(status: AppStateStatus) {
    focusManager.setFocused(status === 'active');
}

export function useAppStateQueryFocus() {
    useEffect(() => {
        syncQueryFocusWithAppState(AppState.currentState);

        const subscription = AppState.addEventListener('change', syncQueryFocusWithAppState);
        return () => {
            subscription.remove();
        };
    }, []);
}
