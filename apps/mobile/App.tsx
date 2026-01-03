import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastProvider } from './src/contexts/ToastContext';
import { queryClient } from './src/lib/queryClient';
import RootNavigator from './src/navigation/RootNavigator';
import { logEnvVars } from './src/utils/debug';

// Логируем переменные окружения при запуске
if (__DEV__) {
    logEnvVars();
}

export default function App() {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <RootNavigator />
                    <StatusBar style="auto" />
                </ToastProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}
