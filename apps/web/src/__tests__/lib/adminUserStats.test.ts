import { collectAdminUserStats } from '@/lib/adminUserStats';
it('loads bounded pages, includes later accounts and deduplicates overlapping IDs', async()=>{
    const first=Array.from({length:200},(_,i)=>({id:String(i),is_blocked:i<3,is_super:i===0}));
    const load=jest.fn().mockResolvedValueOnce({items:first}).mockResolvedValueOnce({items:[first[199],{id:'200',is_blocked:true,is_super:true}]});
    expect(await collectAdminUserStats(load)).toEqual({total:201,active:197,blocked:4,super:2});
    expect(load.mock.calls).toEqual([[1,200],[2,200]]);
});
it('distinguishes truly empty data from a failed page',async()=>{
    expect(await collectAdminUserStats(async()=>({items:[]}))).toEqual({total:0,active:0,blocked:0,super:0});
    await expect(collectAdminUserStats(async()=>{throw new Error('unavailable');})).rejects.toThrow('unavailable');
});
it('fails explicitly rather than silently truncating at the transport pagination bound',async()=>{
    const items=Array.from({length:200},(_,i)=>({id:String(i),is_blocked:false,is_super:false}));
    await expect(collectAdminUserStats(async()=>({items}))).rejects.toThrow('pagination limit');
});
