import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastProvider } from './src/contexts/ToastContext';
import RootNavigator from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 минут
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
});

export default function App() {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <NetworkStatusBanner />
                    <RootNavigator />
                    <StatusBar style="auto" />
                </ToastProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}
