jest.mock('@/hooks/useToast', () => ({
    useToast: () => ({
        showError: jest.fn(),
    }),
}));

jest.mock('@/lib/log', () => ({
    logError: jest.fn(),
}));

import { useShiftItems } from '@/app/staff/finance/hooks/useShiftItems';

describe('useShiftItems module', () => {
    it('exports hook after autosave extraction', () => {
        expect(typeof useShiftItems).toBe('function');
    });
});
