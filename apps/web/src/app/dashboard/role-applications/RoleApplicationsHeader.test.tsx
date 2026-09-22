/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { RoleApplicationsHeader } from './RoleApplicationsHeader';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

test('offers team navigation instead of submitting an application as the owner', () => {
    render(<RoleApplicationsHeader />);
    expect(screen.getByRole('link', { name: 'К сотрудникам' }).getAttribute('href')).toBe('/dashboard/staff');
    expect(screen.getByRole('heading', { level: 1, name: 'Заявки сотрудников' })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText('Открыть форму сотрудника')).toBeNull();
});
