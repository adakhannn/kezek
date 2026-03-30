/**
 * Jest setup file for React Native Testing Library
 *
 * Configures mocks and global test utilities
 */

require('@testing-library/jest-native/extend-expect');

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

jest.mock('expo-network', () => ({
    useNetworkState: jest.fn(() => ({
        isConnected: true,
        isInternetReachable: true,
        type: 'WIFI',
    })),
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
            in: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
            }),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
            single: jest.fn(),
        })),
        rpc: jest.fn().mockResolvedValue({
            data: [],
            error: null,
        }),
    },
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
    return {
        NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
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
        bookingData: {
            business: {
                id: 'test-business-id',
                name: 'Test Salon',
                slug: 'test-salon',
                rating_score: 4.8,
            },
            branches: [
                {
                    id: 'branch-1',
                    name: 'Main Branch',
                    rating_score: 4.7,
                },
            ],
            services: [
                {
                    id: 'service-1',
                    name_ru: 'Тестовая услуга',
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 1500,
                    branch_id: 'branch-1',
                },
            ],
            staff: [
                {
                    id: 'staff-1',
                    full_name: 'Тестовый мастер',
                    branch_id: 'branch-1',
                    rating_score: 4.9,
                    avatar_url: null,
                },
            ],
            promotions: [],
            branchId: 'branch-1',
            serviceId: 'service-1',
            staffId: 'staff-1',
            selectedDate: '2026-03-21',
            selectedSlot: {
                staff_id: 'staff-1',
                branch_id: 'branch-1',
                start_at: '2026-03-21T10:00:00.000Z',
                end_at: '2026-03-21T11:00:00.000Z',
            },
        },
        setBusiness: jest.fn(),
        setBranches: jest.fn(),
        setServices: jest.fn(),
        setStaff: jest.fn(),
        setPromotions: jest.fn(),
        setBranchId: jest.fn(),
        setServiceId: jest.fn(),
        setStaffId: jest.fn(),
        setSelectedDate: jest.fn(),
        setSelectedSlot: jest.fn(),
        reset: jest.fn(),
    }),
}));

// Silence console warnings in tests
global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
};

