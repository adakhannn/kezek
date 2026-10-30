/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { ClientsList } from '@/app/staff/finance/components/ClientsList';
import { staffRu } from '@/app/_components/i18n/dictionaries/staff.ru';
import type { Shift } from '@/app/staff/finance/types';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({locale:'ru',t:(key:string,fallback:string) => staffRu[key as keyof typeof staffRu] ?? fallback}),
}));
const item = {id:'item',clientName:'LIVE TEST',serviceName:'Test service',serviceAmount:301,consumablesAmount:49};
const shift: Shift = {
    id:'shift',shift_date:'2026-10-09',opened_at:'2026-10-08T21:25:00Z',closed_at:'2026-10-08T21:30:00Z',expected_start:null,late_minutes:0,
    status:'closed',total_amount:301,consumables_amount:49,master_share:181,salon_share:169,percent_master:60,percent_salon:40,
};
const props = {
    items:[item],bookings:[],serviceOptions:[],shift,isOpen:false,isClosed:true,isReadOnly:false,expandedItems:new Set<number>(),
    onExpand:jest.fn(),onCollapse:jest.fn(),onUpdateItem:jest.fn(),onDeleteItem:jest.fn(),
};

it('keeps saved clients visible read-only to staff after closing a shift', () => {
    render(<ClientsList {...props} />);
    expect(screen.getAllByText('LIVE TEST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('301 сом').length).toBeGreaterThan(0);
    expect(screen.getAllByText('49 сом').length).toBeGreaterThan(0);
    for (const button of screen.queryAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(staffRu['staff.finance.clients.shiftNotOpen'])).toBeNull();
});

it('does not retain an editor when shift closes while its item was expanded', () => {
    render(<ClientsList {...props} expandedItems={new Set([0])} />);
    expect(screen.getAllByText('LIVE TEST').length).toBeGreaterThan(0);
    expect(screen.queryByRole('textbox')).toBeNull();
});

it('preserves the no-shift staff notice', () => {
    render(<ClientsList {...props} shift={null} items={[]} isClosed={false} />);
    expect(screen.getByText(staffRu['staff.finance.clients.shiftNotOpen'])).toBeTruthy();
});

it('keeps closed shift items visible to the owner without mutation controls', () => {
    render(<ClientsList {...props} staffId="staff" isReadOnly />);
    expect(screen.getAllByText('LIVE TEST').length).toBeGreaterThan(0);
    for (const button of screen.queryAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
});
