/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import StaffFinancePageClient from '@/app/dashboard/staff/[id]/finance/StaffFinancePageClient';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { staffRu } from '@/app/_components/i18n/dictionaries/staff.ru';
import { staffKy } from '@/app/_components/i18n/dictionaries/staff.ky';
import { staffEn } from '@/app/_components/i18n/dictionaries/staff.en';
import { ClientsListHeader } from '@/app/staff/finance/components/ClientsListHeader';
import { ClientsList } from '@/app/staff/finance/components/ClientsList';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/staff/finance/components/FinancePage', () => ({ FinancePage: () => null }));

test.each([['ru', staffRu], ['ky', staffKy], ['en', staffEn]] as const)(
    'uses localized staff navigation and finance workspace in %s', (locale, dictionary) => {
        jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) =>
            (dictionary as Record<string, string>)[key] ?? fallback ?? key,
        } as ReturnType<typeof useLanguage>);
        render(<StaffFinancePageClient id="staff-test" fullName="LIVE TEST" />);
        expect(screen.getByRole('link', { name: dictionary['staff.finance.backToStaff'] }).getAttribute('href'))
            .toBe('/dashboard/staff/staff-test');
        expect(screen.getByText(dictionary['staff.finance.workspace'])).toBeTruthy();
        expect(screen.queryByText('Staff Finance Workspace')).toBeNull();
        if (locale !== 'en') expect(screen.queryByRole('link', { name: 'Back to staff' })).toBeNull();
    },
);

test.each([['ru', staffRu], ['ky', staffKy], ['en', staffEn]] as const)(
    'localizes closed-shift client list and its unavailable-action explanation in %s', (locale, dictionary) => {
        jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) =>
            (dictionary as Record<string, string>)[key] ?? fallback ?? key,
        } as ReturnType<typeof useLanguage>);
        const items = [{id:'item-test',clientName:'LIVE TEST',serviceName:'Service',serviceAmount:301,consumablesAmount:49}];
        render(<>
            <ClientsListHeader shiftDate={new Date('2026-10-09T03:00:00Z')} onShiftDateChange={jest.fn()}
                isOpen={false} isClosed isReadOnly savingItems={false} saving={false} staffId="staff-test"
                onAddClient={jest.fn()} items={items} shift={null} />
            <ClientsList items={items} bookings={[]} serviceOptions={[]} shift={null}
                isOpen={false} isClosed isReadOnly staffId="staff-test" expandedItems={new Set()}
                onExpand={jest.fn()} onCollapse={jest.fn()} onUpdateItem={jest.fn()} onDeleteItem={jest.fn()} />
        </>);
        expect(screen.getByRole('button', {name:dictionary['staff.finance.clients.export']}).getAttribute('title'))
            .toBe(dictionary['staff.finance.clients.export']);
        const addButton = screen.getByRole('button', {name:dictionary['staff.finance.clients.add']});
        expect((addButton as HTMLButtonElement).disabled).toBe(true);
        expect(addButton.getAttribute('title')).toBe(dictionary['staff.finance.permissions.closed']);
        expect(screen.getByText(dictionary['staff.finance.clients.createdAt'])).toBeTruthy();
        expect(screen.getAllByText(dictionary['staff.finance.clients.manual'])).toHaveLength(2);
    },
);
