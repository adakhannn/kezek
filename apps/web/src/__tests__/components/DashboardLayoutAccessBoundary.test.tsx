/** @jest-environment node */

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import DashboardLayout from '@/app/dashboard/layout';
import { DashboardLayoutClient } from '@/app/dashboard/components/DashboardLayoutClient';
import { MobileSidebar } from '@/app/dashboard/components/MobileSidebar';
import { getBizContextForManagers } from '@/lib/authBiz';
import { BizAccessError } from '@/lib/authDiagnostics';

jest.mock('@/lib/authBiz', () => ({
    ...jest.requireActual('@/lib/authDiagnostics'),
    getBizContextForManagers: jest.fn(),
}));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/app/dashboard/components/DashboardLayoutClient', () => ({
    DashboardLayoutClient: jest.fn(() => null),
}));
jest.mock('@/app/dashboard/components/MobileSidebar', () => ({
    MobileSidebar: jest.fn(() => null),
}));
jest.mock('@/components/ErrorBoundary', () => ({
    ErrorBoundary: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const redirectSignal = new Error('UNIT dashboard redirect sentinel');
const protectedText = 'UNIT private applications child';
const ProtectedChild = jest.fn(() => <div>{protectedText}</div>);

async function layout() {
    return DashboardLayout({ children: <ProtectedChild /> });
}

beforeEach(() => {
    jest.clearAllMocks();
    (redirect as unknown as jest.Mock).mockImplementation(() => { throw redirectSignal; });
});

it('renders protected children only after the supplied manager-context resolver succeeds', async () => {
    jest.mocked(getBizContextForManagers).mockResolvedValue({
        bizId: 'unit-allowed-business',
    } as Awaited<ReturnType<typeof getBizContextForManagers>>);
    const html = renderToStaticMarkup(await layout());
    expect(getBizContextForManagers).toHaveBeenCalledTimes(1);
    expect(html).toContain(protectedText);
    expect(ProtectedChild).toHaveBeenCalledTimes(1);
    expect(MobileSidebar).toHaveBeenCalledWith(expect.objectContaining({ bizId: 'unit-allowed-business' }), undefined);
    expect(DashboardLayoutClient).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
});

it.each([
    new BizAccessError('NOT_AUTHENTICATED'),
    new Error('UNAUTHORIZED'),
])('redirects an unauthenticated resolver result before returning children: %p', async (failure) => {
    jest.mocked(getBizContextForManagers).mockRejectedValue(failure);
    await expect(layout()).rejects.toBe(redirectSignal);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/auth/sign-in?redirect=/dashboard');
    expect(ProtectedChild).not.toHaveBeenCalled();
    expect(MobileSidebar).not.toHaveBeenCalled();
});

const diagnostics = { checkedUserRoles: true, eligibleRolesFound: 0, errorsCount: 0 };
it.each([
    { failure: new BizAccessError('SERVICE_UNAVAILABLE'), props: { errorType: 'SERVICE_UNAVAILABLE' } },
    { failure: new BizAccessError('NO_BIZ_ACCESS', undefined, diagnostics), props: { errorType: 'NO_BIZ_ACCESS', diagnostics } },
    { failure: new Error('NO_BIZ_ACCESS'), props: { errorType: 'NO_BIZ_ACCESS', diagnostics: undefined } },
    { failure: new Error('UNIT context read failed'), props: { errorType: 'GENERAL', errorMessage: 'UNIT context read failed' } },
    { failure: 'UNIT non-error rejection', props: { errorType: 'GENERAL', errorMessage: undefined } },
    { failure: new BizAccessError('NO_STAFF_ACCESS'), props: { errorType: 'GENERAL', errorMessage: 'NO_STAFF_ACCESS' } },
])('returns only the appropriate error shell for $props.errorType', async ({ failure, props }) => {
    jest.mocked(getBizContextForManagers).mockRejectedValue(failure);
    const page = await layout();
    expect(page.type).toBe(DashboardLayoutClient);
    expect(page.props).toEqual(props);
    expect(renderToStaticMarkup(page)).not.toContain(protectedText);
    expect(ProtectedChild).not.toHaveBeenCalled();
    expect(MobileSidebar).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
});

it('does not resolve a protected layout while its business context is pending', async () => {
    let complete!: (value: Awaited<ReturnType<typeof getBizContextForManagers>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof getBizContextForManagers>>>((resolve) => { complete = resolve; });
    jest.mocked(getBizContextForManagers).mockReturnValue(pending);
    let settled = false;
    const result = layout().then((page) => { settled = true; return page; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(ProtectedChild).not.toHaveBeenCalled();
    complete({ bizId: 'unit-allowed-business' } as Awaited<ReturnType<typeof getBizContextForManagers>>);
    expect(renderToStaticMarkup(await result)).toContain(protectedText);
});

// The real access-error class is used, but resolver outcomes are supplied by
// mocks. These tests cover layout composition only, not actual roles, tenant
// resolution, HTTP handlers, RLS, session expiry, or browser-visible flashes.
