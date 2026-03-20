/**
 * Jest setup file for React Native Testing Library
 * 
 * Configures mocks and global test utilities
 */

import '@testing-library/jest-native/extend-expect';

// Mock Expo modules
jest.mock('expo-constants', () => ({
    default: {
        expoConfig: {
            extra: {},
        },
        manifest: {
            extra: {},
        },
    },
}));

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
    openBrowserAsync: jest.fn(),
}));

// Mock Supabase client
jest.mock('./src/lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
            getUser: jest.fn(),
            signInWithOtp: jest.fn(),
            signInWithPassword: jest.fn(),
            signUp: jest.fn(),
            signOut: jest.fn(),
            onAuthStateChange: jest.fn(() => ({
                data: { subscription: null },
                unsubscribe: jest.fn(),
            })),
        },
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
        })),
    },
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual('@react-navigation/native');
    return {
        ...actualNav,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
            setOptions: jest.fn(),
        }),
        useRoute: () => ({
            params: {},
        }),
        useFocusEffect: jest.fn(),
    };
});

// Mock React Query
jest.mock('@tanstack/react-query', () => {
    const actualQuery = jest.requireActual('@tanstack/react-query');
    return {
        ...actualQuery,
        useQuery: jest.fn(() => ({
            data: null,
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        })),
        useMutation: jest.fn(() => ({
            mutate: jest.fn(),
            mutateAsync: jest.fn(),
            isLoading: false,
            error: null,
        })),
        QueryClient: jest.fn(() => ({
            invalidateQueries: jest.fn(),
            setQueryData: jest.fn(),
        })),
        QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
    };
});

// Mock Toast Context
jest.mock('./src/contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: jest.fn(),
    }),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Booking Context
jest.mock('./src/contexts/BookingContext', () => ({
    BookingProvider: ({ children }: { children: React.ReactNode }) => children,
    useBooking: () => ({
        bookingData: {},
        updateBookingData: jest.fn(),
        reset: jest.fn(),
    }),
}));

// Silence console warnings in tests
global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
};

