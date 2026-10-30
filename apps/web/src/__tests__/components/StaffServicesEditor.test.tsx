/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import StaffServicesEditor from '@/app/dashboard/staff/[id]/StaffServicesEditor';
import { staffRu } from '@/app/_components/i18n/dictionaries/staff.ru';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({locale:'ru', t: (key: string, fallback: string) => staffRu[key as keyof typeof staffRu] ?? fallback}),
}));
jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        from: (table: string) => {
            if (table === 'services') {
                const query = {select: jest.fn(), eq: jest.fn(), order: jest.fn()};
                query.select.mockReturnValue(query);
                query.eq.mockReturnValue(query);
                query.order.mockResolvedValue({data:[{id:'service', name_ru:'LIVE TEST Service', duration_min:60}],error:null});
                return query;
            }
            return {select: () => ({eq: () => Promise.resolve({data:[],error:null})})};
        },
    },
}));

it('renders a readable localized duration for an assigned service option', async () => {
    render(<StaffServicesEditor staffId="staff" staffBranchId="branch" />);
    expect(await screen.findByText('60 мин')).toBeTruthy();
    expect(screen.queryByText(/РјРёРЅ/)).toBeNull();
});
