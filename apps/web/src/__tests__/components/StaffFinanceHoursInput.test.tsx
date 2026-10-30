/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StaffFinanceShiftCard } from '@/app/dashboard/staff/[id]/finance/components/StaffFinanceShiftCard';
import { financeRu } from '@/app/_components/i18n/dictionaries/finance.ru';
import { commonRu } from '@/app/_components/i18n/dictionaries/common.ru';
import type { StaffFinanceStatsShift } from '@/lib/finance/types';

const shift: StaffFinanceStatsShift = {id:'test-shift',shift_date:'2026-10-12',status:'closed',
    opened_at:'2026-10-11T22:31:43Z',closed_at:'2026-10-11T22:33:00Z',total_amount:0,consumables_amount:0,
    master_share:0,salon_share:0,late_minutes:0,hours_worked:2,hourly_rate:null,guaranteed_amount:0,items:[]};
const t = (key:string,fallback:string) => ({ ...financeRu, ...commonRu } as Record<string,string>)[key] ?? fallback;

function edit() {
    const onHoursUpdated = jest.fn();
    render(<StaffFinanceShiftCard shift={shift} locale="ru" t={t} onHoursUpdated={onHoursUpdated} />);
    fireEvent.click(screen.getByRole('button',{name:/12\.10\.2026/}));
    fireEvent.click(screen.getByRole('button',{name:'Исправить часы',exact:true}));
    return onHoursUpdated;
}

beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ok:true,json:async () => ({ok:true})}); });

test.each(['','-1','25'])('rejects invalid hours %p without a request or update', value => {
    const onHoursUpdated = edit();
    fireEvent.change(screen.getByRole('spinbutton'),{target:{value}});
    fireEvent.click(screen.getByRole('button',{name:'Сохранить',exact:true}));
    expect(screen.getByText('Некорректное значение часов')).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(onHoursUpdated).not.toHaveBeenCalled();
});

test.each(['0','2','24'])('permits explicitly entered valid hours %s', async value => {
    const onHoursUpdated = edit();
    fireEvent.change(screen.getByRole('spinbutton'),{target:{value}});
    fireEvent.click(screen.getByRole('button',{name:'Сохранить',exact:true}));
    await waitFor(() => expect(onHoursUpdated).toHaveBeenCalledTimes(1));
    expect(JSON.parse(jest.mocked(global.fetch).mock.calls[0][1]?.body as string)).toEqual({hours_worked:Number(value)});
});
