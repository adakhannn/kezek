/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';

import { FinancePage } from '@/app/staff/finance/components/FinancePage';

// FE-08: when /api/staff/finance fails, every tab shows the load error with a retry. The stats tab
// used to show "0 сом" and "Всего закрытых смен: 0", the clients tab "open a shift first".

const mockLanguage = { locale: 'ru', t: (_key: string, fallback?: string) => fallback ?? _key };
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => mockLanguage }));
const mockRefetch = jest.fn().mockResolvedValue(undefined);
const mockFinance = {
    data: null, isLoading: false, isError: true, error: new Error('Не удалось загрузить данные смены'),
    refetch: mockRefetch, invalidate: jest.fn(),
};
jest.mock('@/app/staff/finance/hooks/useFinanceData', () => ({ useFinanceData: () => mockFinance }));
const mockTransport = { save: jest.fn(), load: jest.fn(), open: jest.fn(), close: jest.fn() };
jest.mock('@/app/staff/finance/hooks/useFinanceMutations', () => ({ useFinanceMutations: () => mockTransport }));

async function settle() {
    // Let the lazily loaded statistics view resolve if it is rendered at all.
    for (let i = 0; i < 3; i += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

beforeEach(() => {
    window.sessionStorage.clear();
    mockRefetch.mockClear();
});

test('the stats tab shows the load error with a retry, not zero statistics', async () => {
    render(<FinancePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Статистика' }));
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('Не удалось загрузить данные смены');
    expect(screen.queryByText(/Всего закрытых смен/)).toBeNull();
    expect(screen.queryByText(/Общая статистика по сменам/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
});

test('the clients tab shows the load error, not "open a shift first"', async () => {
    render(<FinancePage />);
    fireEvent.click(screen.getByRole('button', { name: /Клиенты/ }));
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('Не удалось загрузить данные смены');
    expect(screen.queryByText(/необходимо сначала открыть смену/)).toBeNull();
});

test('the shift tab keeps its existing error banner', async () => {
    render(<FinancePage />);
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('Ошибка загрузки данных');
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
});
