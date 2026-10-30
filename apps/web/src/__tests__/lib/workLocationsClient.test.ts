import {loadWorkLocationSnapshot, loadWorkLocations} from '@/lib/scheduling/locationsClient';
const originalFetch=global.fetch;
const fetchMock=jest.fn();
beforeEach(() => {fetchMock.mockReset();global.fetch=fetchMock;});
afterAll(() => {global.fetch=originalFetch;});
test('loads only minimal location rows with an explicit complete-projection marker', async () => {
    fetchMock.mockResolvedValue({ok:true,json:async()=>({ok:true,data:[],availabilityComplete:true})});
    expect(await loadWorkLocationSnapshot('biz','2026-10-19','2026-10-19')).toEqual({locations:[],complete:true});
    expect(fetchMock).toHaveBeenCalledWith('/api/public/work-locations?bizId=biz&from=2026-10-19&to=2026-10-19',{cache:'no-store'});
});
test('legacy array wrapper and manager endpoint remain compatible', async () => {
    const rows=[{staff_id:'s',branch_id:'b',date_on:'2026-10-19'}];
    fetchMock.mockResolvedValue({ok:true,json:async()=>({ok:true,data:rows})});
    expect(await loadWorkLocations('biz','2026-10-19','2026-10-19',true)).toEqual(rows);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/staff/work-locations?');
    expect((await loadWorkLocationSnapshot('biz','2026-10-19','2026-10-19')).complete).toBe(false);
});
test.each([false,true])('rejects unsuccessful transport/payload (HTTP ok %s)', async ok => {
    fetchMock.mockResolvedValue({ok,json:async()=>({ok:false,message:'Unavailable'})});
    await expect(loadWorkLocationSnapshot('biz','a','b')).rejects.toThrow('Unavailable');
});
test('a malformed success payload is not authoritative empty availability', async () => {
    fetchMock.mockResolvedValue({ok:true,json:async()=>({ok:true,data:null,availabilityComplete:true})});
    await expect(loadWorkLocationSnapshot('biz','a','b')).rejects.toThrow('Invalid work-location response');
});
