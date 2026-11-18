/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { StaffBusinessChooser } from '@/app/staff/StaffBusinessChooser';

jest.mock('next/navigation', () => ({ usePathname: () => '/staff' }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ locale: 'ru', t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn(), logError: jest.fn(), logDebug: jest.fn() }));

const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';
const optionA = { staffId: STAFF_A, bizId: 'biz-a', branchId: 'branch-a' };
const optionB = { staffId: STAFF_B, bizId: 'biz-b', branchId: null };
const labels = [
    { ...optionA, businessName: 'Салон Алма', branchName: 'Центр' },
    { ...optionB, businessName: 'Барбершоп Арча', branchName: null },
];

describe('StaffBusinessChooser', () => {
    const reload = jest.fn();

    beforeEach(() => {
        reload.mockClear();
        Object.defineProperty(window, 'location', { configurable: true, value: { reload } });
    });

    test('choosing a business remembers it on the server and reloads the cabinet', async () => {
        const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
        global.fetch = mockFetch;
        render(<StaffBusinessChooser options={labels} />);

        fireEvent.click(screen.getByRole('button', { name: /Барбершоп Арча/ }));

        await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
        expect(mockFetch).toHaveBeenCalledWith('/api/me/current-staff', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ staffId: STAFF_B }),
        }));
    });

    test('a refused choice shows an error and does not reload', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ ok: false }) });
        render(<StaffBusinessChooser options={labels} />);

        fireEvent.click(screen.getByRole('button', { name: /Салон Алма/ }));

        expect((await screen.findByRole('alert')).textContent).toContain('Не удалось выбрать бизнес');
        expect(reload).not.toHaveBeenCalled();
    });
});
