/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StaffFinanceShiftCard } from '@/app/dashboard/staff/[id]/finance/components/StaffFinanceShiftCard';
import { financeRu } from '@/app/_components/i18n/dictionaries/finance.ru';
import { commonRu } from '@/app/_components/i18n/dictionaries/common.ru';
import type { StaffFinanceStatsShift } from '@/lib/finance/types';

const shift: StaffFinanceStatsShift = {
    ledger_revision: 7, timezone: 'Asia/Bishkek', day_hours:24,id:'test-shift',shift_date:'2026-10-12',status:'closed',
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
    expect(JSON.parse(jest.mocked(global.fetch).mock.calls[0][1]?.body as string)).toEqual({hours_worked:Number(value),expectedRevision:7});
});


test('captures original revision at edit start across refreshed props and retains 409 draft', async () => {
    const refresh=jest.fn();const props={locale:'ru',t,onHoursUpdated:refresh};
    const view=render(<StaffFinanceShiftCard shift={shift} {...props}/>);
    fireEvent.click(screen.getByRole('button',{name:/12\.10\.2026/}));fireEvent.click(screen.getByRole('button',{name:'Исправить часы',exact:true}));
    fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'9'}});
    view.rerender(<StaffFinanceShiftCard shift={{...shift,ledger_revision:8,hours_worked:3}} {...props}/>);
    jest.mocked(global.fetch).mockResolvedValueOnce({ok:false,status:409,json:async()=>({ok:false,message:'Changed'})} as Response);
    fireEvent.click(screen.getByRole('button',{name:'Сохранить',exact:true}));
    await waitFor(()=>expect(screen.getByText('Changed')).toBeTruthy());
    expect(JSON.parse(jest.mocked(global.fetch).mock.calls[0][1]?.body as string)).toEqual({hours_worked:9,expectedRevision:7});
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('9');
    expect((screen.getByRole('spinbutton') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button',{name:'Сохранить',exact:true}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Сохранить',exact:true}));expect(global.fetch).toHaveBeenCalledTimes(1);expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Discard input and reload shift'}));await waitFor(()=>expect(refresh).toHaveBeenCalledTimes(1));
    await waitFor(()=>expect(screen.queryByRole('spinbutton')).toBeNull());
    fireEvent.click(screen.getByRole('button',{name:'Исправить часы',exact:true}));
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('3.00');
    fireEvent.click(screen.getByRole('button',{name:'Сохранить',exact:true}));await waitFor(()=>expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(jest.mocked(global.fetch).mock.calls[1][1]?.body as string).expectedRevision).toBe(8);
});

test('serializes double Save and freezes editor while response is uncertain', async () => {
    let resolve!: (value:Response)=>void;jest.mocked(global.fetch).mockReturnValueOnce(new Promise(r=>{resolve=r;}));
    const refresh=edit();const button=screen.getByRole('button',{name:'Сохранить',exact:true});
    fireEvent.click(button);fireEvent.click(button);expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button',{name:'Отмена',exact:true}) as HTMLButtonElement).disabled).toBe(true);
    await act(async()=>resolve({ok:true,json:async()=>({ok:true})} as Response));expect(refresh).toHaveBeenCalledTimes(1);
});

test('permits 25 hours only when the returned business calendar day has 25 hours', async () => {
    const refresh=jest.fn();render(<StaffFinanceShiftCard shift={{...shift,day_hours:25}} locale="ru" t={t} onHoursUpdated={refresh}/>);
    fireEvent.click(screen.getByRole('button',{name:/12\.10\.2026/}));fireEvent.click(screen.getByRole('button',{name:'Исправить часы',exact:true}));
    fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'25'}});fireEvent.click(screen.getByRole('button',{name:'Сохранить',exact:true}));
    await waitFor(()=>expect(refresh).toHaveBeenCalledTimes(1));expect(JSON.parse(jest.mocked(global.fetch).mock.calls[0][1]?.body as string).hours_worked).toBe(25);
});


test('a background reopen keeps the hours draft visible until explicit discard', async () => {
    const props={locale:'ru',t,onHoursUpdated:jest.fn()};const view=render(<StaffFinanceShiftCard shift={shift} {...props}/>);
    fireEvent.click(screen.getByRole('button',{name:/12\.10\.2026/}));fireEvent.click(screen.getByRole('button',{name:'Исправить часы',exact:true}));
    fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'6'}});
    view.rerender(<StaffFinanceShiftCard shift={{...shift,status:'open',ledger_revision:8}} {...props}/>);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('6');
    jest.mocked(global.fetch).mockResolvedValueOnce({ok:false,status:409,json:async()=>({ok:false,message:'Reopened'})} as Response);
    fireEvent.click(screen.getByRole('button',{name:'Сохранить',exact:true}));await waitFor(()=>expect(screen.getByText('Reopened')).toBeTruthy());
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('6');
    expect(JSON.parse(jest.mocked(global.fetch).mock.calls[0][1]?.body as string).expectedRevision).toBe(7);
});
