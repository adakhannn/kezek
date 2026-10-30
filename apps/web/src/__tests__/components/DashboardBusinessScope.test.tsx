/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import DashboardLayout from '@/app/dashboard/layout';
import { getBizContextForManagers } from '@/lib/authBiz';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
    BizAccessError: class extends Error {},
}));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/app/dashboard/components/MobileSidebar', () => ({
    MobileSidebar: ({ bizId }: { bizId: string }) => <aside>{bizId}</aside>,
}));
jest.mock('@/app/dashboard/components/DashboardLayoutClient', () => ({
    DashboardLayoutClient: () => <div>Access error</div>,
}));
jest.mock('@/lib/errorMonitoring', () => ({ reportErrorToMonitoring: jest.fn() }));

function BusinessDraft() {
    const [draft, setDraft] = useState('initial');
    return <input aria-label="Business draft" value={draft} onChange={(event) => setDraft(event.target.value)} />;
}

async function scopedLayout(bizId: string) {
    jest.mocked(getBizContextForManagers).mockResolvedValueOnce({ bizId } as Awaited<ReturnType<typeof getBizContextForManagers>>);
    return DashboardLayout({ children: <BusinessDraft /> });
}

describe('Dashboard business identity boundary', () => {
    beforeEach(() => jest.clearAllMocks());

    it('discards mounted page data and drafts when the resolved business changes', async () => {
        const view = render(await scopedLayout('business-one'));
        fireEvent.change(screen.getByLabelText('Business draft'), { target: { value: 'private old-business draft' } });
        view.rerender(await scopedLayout('business-two'));
        expect((screen.getByLabelText('Business draft') as HTMLInputElement).value).toBe('initial');
        expect(screen.getByText('business-two')).toBeTruthy();
    });

    it('preserves a draft for a refresh within the same business', async () => {
        const view = render(await scopedLayout('business-one'));
        fireEvent.change(screen.getByLabelText('Business draft'), { target: { value: 'current draft' } });
        view.rerender(await scopedLayout('business-one'));
        expect((screen.getByLabelText('Business draft') as HTMLInputElement).value).toBe('current draft');
    });
});
