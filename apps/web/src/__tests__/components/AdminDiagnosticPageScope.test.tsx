/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import MonitoringPage from '@/app/admin/monitoring/page';
import SystemHealthPage from '@/app/admin/system-health/page';

jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn(async () => { throw new Error('NO_BUSINESS_ROLE'); }) }));
jest.mock('@/app/admin/monitoring/MonitoringClient', () => ({ __esModule: true, default: () => <div>Platform monitoring</div> }));
jest.mock('@/app/admin/system-health/SystemHealthClient', () => ({ __esModule: true, default: () => <div>Platform health</div> }));
jest.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));

test.each([[MonitoringPage, 'Platform monitoring'], [SystemHealthPage, 'Platform health']] as const)(
    'platform diagnostic page delegates authorization to admin layout without requiring a tenant role', async (Page, label) => {
        render(await Page());
        expect(screen.getByText(label)).toBeTruthy();
    },
);
