/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import StaffDetailPageClient from '@/app/dashboard/staff/[id]/StaffDetailPageClient';
import { staffRu } from '@/app/_components/i18n/dictionaries/staff.ru';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({t: (key: string, fallback: string) => staffRu[key as keyof typeof staffRu] ?? fallback}),
}));
jest.mock('@/app/dashboard/staff/StaffForm', () => ({__esModule: true, default: () => null}));
jest.mock('@/app/dashboard/staff/[id]/StaffServicesEditor', () => ({__esModule: true, default: () => null}));
jest.mock('@/app/dashboard/staff/[id]/DangerActions', () => ({__esModule: true, default: () => null}));
jest.mock('@/app/dashboard/staff/[id]/TransferStaffDialog', () => ({__esModule: true, default: () => null}));

it('substitutes the configured rating window in the staff detail description', () => {
    render(<StaffDetailPageClient
        staff={{id:'staff', full_name:'LIVE TEST Staff', email:null, phone:null,
            branch_id:'branch', is_active:true, percent_master:60, percent_salon:40, hourly_rate:null}}
        branches={[]} reviews={[]}
        ratingWeights={{reviews:35, productivity:25, loyalty:20, discipline:20, windowDays:45}}
    />);
    expect(screen.getByText('Каждый рабочий день влияет на рейтинг за последние 45 дней.')).toBeTruthy();
    expect(screen.queryByText(/\{days\}/)).toBeNull();
});
