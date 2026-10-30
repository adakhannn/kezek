/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import AdminBookingsView from '@/app/dashboard/bookings/view';
import { BookingFilters } from '@/app/dashboard/bookings/components/BookingFilters';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { bookingsRu } from '@/app/_components/i18n/dictionaries/bookings.ru';
import { bookingsKy } from '@/app/_components/i18n/dictionaries/bookings.ky';
import { bookingsEn } from '@/app/_components/i18n/dictionaries/bookings.en';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({useLanguage: jest.fn()}));
jest.mock('@/app/dashboard/bookings/components/BookingsViewSections', () => ({BookingsViewTabs: () => null, CalendarDaySection: () => null}));
jest.mock('@/app/dashboard/bookings/components/DashboardBookingsListSection', () => ({DashboardBookingsListSection: () => null}));
jest.mock('@/app/dashboard/bookings/components/QuickDesk', () => ({QuickDesk: () => null}));
jest.mock('@/app/dashboard/bookings/notify', () => ({notify: jest.fn()}));

test.each([['ru', bookingsRu], ['ky', bookingsKy], ['en', bookingsEn]] as const)(
    'localizes workspace summary headings and QuickDesk copy in %s', (locale, dictionary) => {
        jest.mocked(useLanguage).mockReturnValue({locale, t: (key: string, fallback?: string) =>
            (dictionary as Record<string, string>)[key] ?? fallback ?? key,
        } as ReturnType<typeof useLanguage>);
        render(<AdminBookingsView bizId="biz" services={[]} staff={[]} branches={[]} initial={[]} />);
        expect(screen.getByText(dictionary['bookings.desk.today'], {selector: 'p'})).toBeTruthy();
        expect(screen.getByText(dictionary['bookings.workspace.summary.historyTitle'])).toBeTruthy();
        expect(dictionary['bookings.desk.primaryActionDesc']).not.toContain('action bar');
        if (locale !== 'en') {
            expect(screen.queryByText('Today')).toBeNull();
            expect(screen.queryByText('History')).toBeNull();
            expect(dictionary['bookings.desk.clientNone.hint']).not.toBe('Walk-in');
        }
    },
);

test.each([['ru', bookingsRu], ['ky', bookingsKy], ['en', bookingsEn]] as const)(
    'localizes history filters and no-show status in %s', (locale, dictionary) => {
        jest.mocked(useLanguage).mockReturnValue({locale, t: (key: string, fallback?: string) =>
            (dictionary as Record<string, string>)[key] ?? fallback ?? key,
        } as ReturnType<typeof useLanguage>);
        render(<BookingFilters statusFilter="all" branchFilter="all" searchQuery="test"
            branches={[]} onStatusChange={jest.fn()} onBranchChange={jest.fn()} onSearchChange={jest.fn()}
            onRefresh={jest.fn()} isLoading={false} timezone="Asia/Bishkek" visibleCount={1} totalCount={2} />);
        expect(screen.getByLabelText(dictionary['bookings.filters.search'])).toBeTruthy();
        expect(screen.getByText(dictionary['bookings.workspace.mode.search'])).toBeTruthy();
        expect(screen.getByRole('option', {name: dictionary['bookings.status.noShow']})).toBeTruthy();
        if (locale !== 'ru') {
            expect(screen.queryByText('Режим поиска')).toBeNull();
            expect(screen.queryByText('Все активные')).toBeNull();
        }
    },
);
