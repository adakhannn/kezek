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

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({
        t: (_key: string, fallback?: string) => fallback ?? '',
    }),
}));

jest.mock('@/lib/log', () => ({
    logError: jest.fn(),
}));

jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        from: jest.fn(),
        channel: jest.fn(() => ({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn(),
        })),
        removeChannel: jest.fn(),
    },
}));

import Client from '@/app/dashboard/staff/[id]/schedule/Client';

describe('Staff schedule Client module', () => {
    it('exports screen component after first decomposition step', () => {
        expect(typeof Client).toBe('function');
    });
});
