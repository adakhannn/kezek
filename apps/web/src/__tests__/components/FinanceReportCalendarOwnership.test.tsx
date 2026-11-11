/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useStaffFinanceStatsData } from '@/app/dashboard/staff/[id]/finance/components/useStaffFinanceStatsData';
import { useAllStaffFinanceStatsData } from '@/app/dashboard/finance/components/useAllStaffFinanceStatsData';
jest.mock('@/lib/log',()=>({logDebug:jest.fn(),logError:jest.fn()}));
const t=(_key:string,fallback='')=>fallback;
const response=(dateFrom:string,label:string)=>({ok:true,json:async()=>({ok:true,data:{dateFrom,staffStats:[{staffName:label}],totalStats:{totalAmount:1},branches:[],stats:{dateFrom,staffName:label,shifts:[]}}})} as Response);
function pending(){let resolve!: (response:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r;});return {promise,resolve};}
beforeEach(()=>{global.fetch=jest.fn();});
afterEach(()=>jest.restoreAllMocks());

test('staff default request uses server day, selected date is preserved, and late previous staff cannot replace snapshot',async()=>{
    const older=pending(),newer=pending();
    const fetchMock=jest.spyOn(global,'fetch').mockResolvedValueOnce(response('2026-11-09','A')).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const {result,rerender}=renderHook(({staffId})=>useStaffFinanceStatsData({staffId,t}),{initialProps:{staffId:'A'}});
    await waitFor(()=>expect(result.current.loading).toBe(false));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/dashboard/staff/A/finance/stats?period=day');expect(result.current.date).toBe('2026-11-09');expect(fetchMock).toHaveBeenCalledTimes(1);
    act(()=>result.current.setDate('2026-03-08'));await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toContain('date=2026-03-08');
    rerender({staffId:'B'});expect(result.current.stats).toBeNull();expect(result.current.loading).toBe(true);
    await act(async()=>newer.resolve(response('2026-03-08','B')));expect(result.current.stats?.staffName).toBe('B');
    await act(async()=>older.resolve(response('2026-03-08','A old')));expect(result.current.stats?.staffName).toBe('B');expect(result.current.date).toBe('2026-03-08');
});

test('all-staff default uses server date without extra fetch; period changes hide old totals and ignore late result',async()=>{
    const month=pending(),year=pending();
    const fetchMock=jest.spyOn(global,'fetch').mockResolvedValueOnce(response('2026-11-09','initial')).mockReturnValueOnce(month.promise).mockReturnValueOnce(year.promise);
    const {result}=renderHook(()=>useAllStaffFinanceStatsData({t}));await waitFor(()=>expect(result.current.loading).toBe(false));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/dashboard/finance/all?period=day');expect(result.current.date).toBe('2026-11-09');expect(fetchMock).toHaveBeenCalledTimes(1);
    act(()=>result.current.setPeriod('month'));expect(result.current.totalStats).toBeNull();await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
    act(()=>result.current.setPeriod('year'));await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(3));
    await act(async()=>year.resolve(response('2026-01-01','year')));expect(result.current.staffStats[0].staffName).toBe('year');
    await act(async()=>month.resolve(response('2026-11-01','late month')));expect(result.current.staffStats[0].staffName).toBe('year');expect(result.current.date).toBe('2026-01-01');
});

test('staff HTTP error and incomplete response are not success',async()=>{
    jest.spyOn(global,'fetch').mockResolvedValueOnce({ok:false,json:async()=>({ok:true,data:{stats:{dateFrom:'2026-11-09'}}})} as Response);
    const {result}=renderHook(()=>useStaffFinanceStatsData({staffId:'A',t}));await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.error).toBeTruthy();expect(result.current.stats).toBeNull();
});
