import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RootNavigator from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 минут
        },
    },
});

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <RootNavigator />
            <StatusBar style="auto" />
        </QueryClientProvider>
    );
}
