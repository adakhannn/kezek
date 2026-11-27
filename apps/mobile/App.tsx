import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ConfirmProvider } from './src/contexts/ConfirmContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { colors } from './src/constants/colors';
import { useAppStateQueryFocus } from './src/hooks/useAppStateQueryFocus';
import { LanguageProvider } from './src/i18n';
import { queryClient } from './src/lib/queryClient';
import { configureNotificationPresentation } from './src/lib/pushNotifications';
import RootNavigator from './src/navigation/RootNavigator';
import { logEnvVars } from './src/utils/debug';

// Booking pushes that arrive while the app is open are shown too.
configureNotificationPresentation();

// Log environment wiring only in development builds.
if (__DEV__) {
    logEnvVars();
}

export default function App() {
    useAppStateQueryFocus();

    // LanguageProvider outside ErrorBoundary: the crash screen (ErrorDisplay) is in the chosen language.
    // SafeAreaProvider at the root: the toast above the navigator reads the insets too.
    return (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <LanguageProvider>
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
            </LanguageProvider>
        </SafeAreaProvider>
    );
}
