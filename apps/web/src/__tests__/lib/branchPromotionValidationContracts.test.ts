import { updateBranchPromotion } from '@/lib/branchPromotionService';
import { createBranchPromotion } from '@/lib/branchPromotionsService';

function fakeAdmin(readData: unknown = {id:'promotion',promotion_type:'free_after_n_visits'}, writeError: unknown = null) {
    const read = {select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),
        maybeSingle:jest.fn(async () => ({data:readData,error:null}))};
    const write = {insert:jest.fn().mockReturnThis(),update:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),
        select:jest.fn().mockReturnThis(),single:jest.fn(async () => ({data:{id:'promotion'},error:writeError}))};
    return {admin:{from:jest.fn().mockReturnValueOnce(read).mockReturnValue(write)},read,write};
}

describe.each(['create','update'] as const)('%s promotion validation metadata', operation => {
    const invoke = (admin: unknown, body: Record<string, unknown>) => operation === 'create'
        ? createBranchPromotion({admin,branchId:'branch',bizId:'biz',body:body as Parameters<typeof createBranchPromotion>[0]['body']})
        : updateBranchPromotion({admin,branchId:'branch',bizId:'biz',promotionId:'promotion',body:body as Parameters<typeof updateBranchPromotion>[0]['body']});

    test.each([-1,0,'4'])('rejects invalid visit count %p without writing', async visit_count => {
        const {admin,write,read} = fakeAdmin();
        const result = await invoke(admin,{promotion_type:'free_after_n_visits',title_ru:'LIVE TEST',params:{visit_count}});
        expect(result).toMatchObject({ok:false,status:400,error:'validation',details:{field:'params.visit_count'}});
        expect(write.insert).not.toHaveBeenCalled(); expect(write.update).not.toHaveBeenCalled();
        expect(read.eq).toHaveBeenCalledWith('biz_id','biz');
        expect(read.eq).toHaveBeenCalledWith(operation === 'create' ? 'id' : 'branch_id','branch');
    });

    test.each(['birthday_discount','first_visit_discount'] as const)('rejects invalid %s percentages and keeps boundaries', async promotion_type => {
        for (const discount_percent of [0,-1,101,'10']) {
            const {admin,write} = fakeAdmin();
            expect(await invoke(admin,{promotion_type,title_ru:'LIVE TEST',params:{discount_percent}}))
                .toMatchObject({ok:false,status:400,error:'validation',details:{field:'params.discount_percent'}});
            expect(write.insert).not.toHaveBeenCalled(); expect(write.update).not.toHaveBeenCalled();
        }
        for (const discount_percent of [1,100]) {
            const {admin} = fakeAdmin();
            expect(await invoke(admin,{promotion_type,title_ru:'LIVE TEST',params:{discount_percent}})).toMatchObject({ok:true});
        }
    });

    test('fails ownership lookup before writing', async () => {
        const {admin,write} = fakeAdmin(null);
        expect(await invoke(admin,{title_ru:'LIVE TEST'})).toMatchObject({ok:false,status:404,error:'not_found'});
        expect(write.insert).not.toHaveBeenCalled(); expect(write.update).not.toHaveBeenCalled();
    });

    test('preserves optional fields and inactive state with valid payload', async () => {
        for (const value of ['value','']) {
            const {admin,write} = fakeAdmin();
            const body = {promotion_type:'referral_free',title_ru:'LIVE TEST',params:{},title_ky:value,title_en:value,
                description_ru:value,description_ky:value,description_en:value,is_active:false,
                valid_from:'2026-10-12',valid_to:null};
            expect(await invoke(admin,body)).toMatchObject({ok:true});
            expect(operation === 'create' ? write.insert : write.update).toHaveBeenCalledWith(expect.objectContaining({
                title_ky:value || null,title_en:value || null,description_ky:value || null,description_en:value || null,
                is_active:false,valid_from:'2026-10-12',valid_to:null,
            }));
        }
    });

    test('reports persistence failure instead of success', async () => {
        const {admin} = fakeAdmin(undefined,{message:'database failed'});
        expect(await invoke(admin,{promotion_type:'referral_free',title_ru:'LIVE TEST'}))
            .toMatchObject({ok:false,status:500,error:'internal'});
    });
});

test('create preserves required-field validation without a mutation', async () => {
    const {admin,write} = fakeAdmin();
    expect(await createBranchPromotion({admin,branchId:'branch',bizId:'biz',
        body:{promotion_type:'referral_free',title_ru:''}})).toMatchObject({ok:false,status:400,error:'validation'});
    expect(write.insert).not.toHaveBeenCalled();
});
