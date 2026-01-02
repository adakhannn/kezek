import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import RootNavigator from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 минут
            refetchOnWindowFocus: false,
        },
    },
});

export default function App() {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <RootNavigator />
                <StatusBar style="auto" />
            </QueryClientProvider>
        </ErrorBoundary>
    );
}
