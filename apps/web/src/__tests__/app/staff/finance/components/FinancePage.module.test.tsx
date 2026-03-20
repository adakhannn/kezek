jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({
        t: (_key: string, fallback?: string) => fallback ?? '',
    }),
}));

jest.mock('@/components/ui/ProgressBar', () => ({
    LoadingOverlay: () => null,
}));

jest.mock('@/components/ui/Toast', () => ({
    ToastContainer: () => null,
}));

jest.mock('@/hooks/useToast', () => ({
    useToast: () => ({
        toasts: [],
        removeToast: jest.fn(),
        showError: jest.fn(),
    }),
}));

jest.mock('@/app/staff/finance/hooks/useFinanceData', () => ({
    useFinanceData: () => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        invalidate: jest.fn(),
    }),
}));

jest.mock('@/app/staff/finance/hooks/useFinanceMutations', () => ({
    useFinanceMutations: () => ({
        isOpening: false,
        isClosing: false,
        isSaving: false,
    }),
}));

jest.mock('@/app/staff/finance/hooks/useFinancePageState', () => ({
    useFinancePageState: () => ({
        activeTab: 'shift',
        activeTabRef: { current: 'shift' },
        handleTabChange: jest.fn(),
        statsPeriod: 'all',
        setStatsPeriod: jest.fn(),
        shiftDate: new Date('2026-03-20T00:00:00Z'),
        setShiftDate: jest.fn(),
        selectedDate: new Date('2026-03-20T00:00:00Z'),
        setSelectedDate: jest.fn(),
        selectedMonth: new Date('2026-03-01T00:00:00Z'),
        setSelectedMonth: jest.fn(),
        selectedYear: 2026,
        setSelectedYear: jest.fn(),
        showShiftDetails: false,
        setShowShiftDetails: jest.fn(),
    }),
}));

jest.mock('@/app/staff/finance/hooks/useFinanceDatePrefetch', () => ({
    useFinanceDatePrefetch: jest.fn(),
}));

jest.mock('@/app/staff/finance/hooks/useServiceOptions', () => ({
    useServiceOptions: () => ({ serviceOptions: [] }),
}));

jest.mock('@/app/staff/finance/hooks/useShiftCalculations', () => ({
    useShiftCalculations: () => ({
        calculations: {
            totalAmount: 0,
            totalConsumables: 0,
            masterShare: 0,
            salonShare: 0,
        },
    }),
}));

jest.mock('@/app/staff/finance/hooks/useShiftStats', () => ({
    useShiftStats: () => ({
        stats: null,
    }),
}));

jest.mock('@/app/staff/finance/components/ClientsList', () => ({
    ClientsList: () => null,
}));

jest.mock('@/app/staff/finance/components/ClientsListHeader', () => ({
    ClientsListHeader: () => null,
}));

jest.mock('@/app/staff/finance/components/ShiftControls', () => ({
    ShiftControls: () => null,
}));

jest.mock('@/app/staff/finance/components/ShiftHeader', () => ({
    ShiftHeader: () => null,
}));

jest.mock('@/app/staff/finance/components/ShiftSummary', () => ({
    ShiftSummary: () => null,
}));

jest.mock('@/app/staff/finance/components/Tabs', () => ({
    Tabs: () => null,
}));

jest.mock('@/app/staff/finance/components/StatsView', () => ({
    StatsView: () => null,
}));

import { FinancePage } from '@/app/staff/finance/components/FinancePage';

describe('FinancePage module', () => {
    it('exports component after page-state extraction step', () => {
        expect(typeof FinancePage).toBe('object');
    });
});
