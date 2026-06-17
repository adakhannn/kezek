import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ConfirmProvider } from './src/contexts/ConfirmContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { colors } from './src/constants/colors';
import { useAppStateQueryFocus } from './src/hooks/useAppStateQueryFocus';
import { queryClient } from './src/lib/queryClient';
import RootNavigator from './src/navigation/RootNavigator';
import { logEnvVars } from './src/utils/debug';

// Log environment wiring only in development builds.
if (__DEV__) {
    logEnvVars();
}

export default function App() {
    useAppStateQueryFocus();

    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ConfirmProvider>
                    <ToastProvider>
                        <RootNavigator />
                        <StatusBar style="light" backgroundColor={colors.surface.page} />
                    </ToastProvider>
                </ConfirmProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}
