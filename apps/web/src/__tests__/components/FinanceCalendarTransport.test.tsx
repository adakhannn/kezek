/** @jest-environment jsdom */
import { fetchFinanceData } from '@/app/staff/finance/hooks/useFinanceData';
import { fetchWithRetry } from '@/app/staff/finance/utils/networkRetry';
import { financeDateLabel, financeDateValue } from '@/app/staff/finance/utils/calendar';
jest.mock('@/app/staff/finance/utils/networkRetry', () => ({ fetchWithRetry: jest.fn() }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/hooks/useToast', () => ({ useToast: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(fetchWithRetry).mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { today: { shift: null, items: [] } } }) } as Response); });
test('default today leaves date selection to the business-calendar server', async () => {
    await fetchFinanceData(undefined, null);
    expect(fetchWithRetry).toHaveBeenCalledWith('/api/staff/finance', expect.anything(), expect.anything());
});
test('explicit calendar label survives transport without an instant conversion', async () => {
    await fetchFinanceData('staff', '2026-11-01');
    expect(fetchWithRetry).toHaveBeenCalledWith('/api/staff/finance?staffId=staff&date=2026-11-01', expect.anything(), expect.anything());
    expect(financeDateLabel(financeDateValue('2026-03-08'))).toBe('2026-03-08');
});
