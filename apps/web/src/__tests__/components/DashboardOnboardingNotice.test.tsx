/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { DashboardOnboardingNotice } from '@/app/dashboard/components/home/DashboardOnboardingNotice';
import { dashboardRu } from '@/app/_components/i18n/dictionaries/dashboard.ru';
import { dashboardKy } from '@/app/_components/i18n/dictionaries/dashboard.ky';
import { dashboardEn } from '@/app/_components/i18n/dictionaries/dashboard.en';

describe('DashboardOnboardingNotice', () => {
    it.each([
        [dashboardRu, 'Осталось: 2'],
        [dashboardKy, 'Калды: 2'],
        [dashboardEn, 'Remaining: 2'],
    ])('renders the localized remaining count', (dictionary, expected) => {
        render(<DashboardOnboardingNotice title="Setup" summaryLabel="Readiness"
            items={['First step', 'Second step']}
            remainingLabel={dictionary['dashboard.onboarding.remaining']} />);
        expect(screen.getByText(expected)).toBeTruthy();
        expect(screen.queryByText('2 open')).toBeNull();
    });

    it('does not render an empty checklist', () => {
        const { container } = render(<DashboardOnboardingNotice title="Setup"
            summaryLabel="Readiness" items={[]} remainingLabel="Remaining: {count}" />);
        expect(container.firstChild).toBeNull();
    });
});
