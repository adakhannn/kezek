import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useAuthAppStateRecovery({
    onAppActive,
}: {
    onAppActive: () => Promise<void> | void;
}) {
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            const wasBackground =
                appStateRef.current === 'background' || appStateRef.current === 'inactive';
            appStateRef.current = nextAppState;

            if (!wasBackground || nextAppState !== 'active') {
                return;
            }

            void onAppActive();
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            subscription.remove();
        };
    }, [onAppActive]);
}

