import React from 'react';
import { renderToString } from 'react-dom/server';

import StaffLayout from '@/app/staff/layout';
import { StaffSelectionRequiredError } from '@/lib/authDiagnostics';

jest.mock('next/navigation', () => ({ usePathname: () => '/staff' }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ locale: 'ru', t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('@/lib/authBiz', () => {
    const actual = jest.requireActual('@/lib/authDiagnostics');
    return {
        getStaffContext: jest.fn(),
        BizAccessError: actual.BizAccessError,
        StaffSelectionRequiredError: actual.StaffSelectionRequiredError,
    };
});
jest.mock('@/lib/staffSelectionLabels', () => ({ loadStaffOptionLabels: jest.fn() }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn(), logError: jest.fn(), logDebug: jest.fn() }));

const { getStaffContext } = jest.requireMock('@/lib/authBiz');
const { loadStaffOptionLabels } = jest.requireMock('@/lib/staffSelectionLabels');

const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';
const optionA = { staffId: STAFF_A, bizId: 'biz-a', branchId: 'branch-a' };
const optionB = { staffId: STAFF_B, bizId: 'biz-b', branchId: null };
const labels = [
    { ...optionA, businessName: 'Салон Алма', branchName: 'Центр' },
    { ...optionB, businessName: 'Барбершоп Арча', branchName: null },
];

async function renderLayout() {
    const element = await StaffLayout({ children: <p>cabinet page</p> });
    return renderToString(element);
}

// ARCH-02: a master of several businesses used to be locked out of the cabinet entirely.
describe('staff layout with several businesses', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        loadStaffOptionLabels.mockResolvedValue(labels);
    });

    test('without a chosen business the layout shows the chooser instead of the cabinet', async () => {
        getStaffContext.mockRejectedValue(new StaffSelectionRequiredError([optionA, optionB]));

        const html = await renderLayout();

        expect(loadStaffOptionLabels).toHaveBeenCalledWith([optionA, optionB]);
        expect(html).toContain('Выберите бизнес');
        expect(html).toContain('Салон Алма');
        expect(html).toContain('Барбершоп Арча');
        expect(html).not.toContain('cabinet page');
    });

    test('with a chosen business the cabinet shows its name and a switcher', async () => {
        getStaffContext.mockResolvedValue({ staffId: STAFF_B, bizId: 'biz-b', branchId: null, staffOptions: [optionA, optionB] });

        const html = await renderLayout();

        expect(html).toContain('cabinet page');
        expect(html).toContain('staff-business-switcher');
        expect(html).toContain('Барбершоп Арча');
    });

    test('a master of one business sees no switcher and no extra lookup', async () => {
        getStaffContext.mockResolvedValue({ staffId: STAFF_A, bizId: 'biz-a', branchId: 'branch-a', staffOptions: [optionA] });

        const html = await renderLayout();

        expect(html).toContain('cabinet page');
        expect(html).not.toContain('staff-business-switcher');
        expect(loadStaffOptionLabels).not.toHaveBeenCalled();
    });
});
