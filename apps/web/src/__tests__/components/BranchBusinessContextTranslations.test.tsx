/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getT } from '@/app/_components/i18n/server';
import EditBranchPageClient from '@/app/dashboard/branches/[id]/EditBranchPageClient';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/dashboard/branches/BranchForm', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/dashboard/branches/DeleteBranchButton', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/admin/branches/BranchScheduleEditor', () => ({ BranchScheduleEditor: () => null }));
jest.mock('@/app/dashboard/branches/[id]/BranchPromotionsPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/dashboard/branches/[id]/BranchRatingCard', () => ({ __esModule: true, default: () => null }));

const branch = { id: 'branch-1', name: 'Филиал 1 Бизнеса 2', address: null, is_active: true, lat: null, lon: null, contact_phone: null, contact_whatsapp: null, contact_email: null, website_url: null, inherit_business_contacts: true };
const cases = [
    ['ru', 'Бизнес', 'Ваш бизнес в Kezek'],
    ['en', 'Business', 'Your business in Kezek'],
    ['ky', 'Бизнес', 'Kezekтеги бизнесиңиз'],
] as const;

test.each(cases)('%s supplies both existing business-context keys', (locale, label, fallback) => {
    const t = getT(locale);
    expect(t('branches.edit.bizContext')).toBe(label);
    expect(t('branches.edit.bizDefaultName')).toBe(fallback);
});

test.each(cases)('%s localizes the context label without translating authored business name', (locale, label) => {
    jest.mocked(useLanguage).mockReturnValue({ locale, t: getT(locale) } as ReturnType<typeof useLanguage>);
    render(<EditBranchPageClient branch={branch} isSuperAdmin={false} bizId="business-2" bizSlug="test-business" bizName="Тестовый бизнес 2" />);
    expect(screen.getByText(`${label}: Тестовый бизнес 2`, { exact: true })).toBeTruthy();
});

test.each(cases)('%s uses localized fallback only when the authored name is missing (component control)', (locale, label, fallback) => {
    jest.mocked(useLanguage).mockReturnValue({ locale, t: getT(locale) } as ReturnType<typeof useLanguage>);
    render(<EditBranchPageClient branch={branch} isSuperAdmin={false} bizId="business-2" bizSlug="test-business" bizName={null} />);
    expect(screen.getByText(`${label}: ${fallback}`, { exact: true })).toBeTruthy();
});
