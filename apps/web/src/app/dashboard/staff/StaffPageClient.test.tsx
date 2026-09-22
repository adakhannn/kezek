/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import StaffPageClient from './StaffPageClient';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
jest.mock('./StaffListClient', () => ({ __esModule: true, default: () => null }));
jest.mock('./FlashBanner', () => ({ __esModule: true, default: () => null }));

test('keeps application history accessible with no pending requests', () => {
    render(<StaffPageClient initialRows={[]} staffApplications={{ pending: 0 }} />);
    expect(screen.getByRole('link', { name: /Заявки сотрудников/ }).getAttribute('href')).toBe('/dashboard/role-applications');
    expect(screen.getByText('Новых заявок нет. История рассмотрения доступна здесь.')).toBeTruthy();
});
test('does not display an owner action without access', () => {
    render(<StaffPageClient initialRows={[]} staffApplications={null} />);
    expect(screen.queryByText('Заявки сотрудников')).toBeNull();
});
test('displays unavailable separately from empty', () => {
    render(<StaffPageClient initialRows={[]} staffApplications={{ pending: null }} />);
    expect(screen.getByText('Не удалось загрузить количество. Откройте список заявок.')).toBeTruthy();
    expect(screen.queryByText('Новых заявок нет. История рассмотрения доступна здесь.')).toBeNull();
});
