import { listBranchesMap } from '@/lib/branchesMapService';
import { loadPublicCategoryLabels } from '@/lib/publicCategoryLabels';
jest.mock('@/lib/publicCategoryLabels', () => ({loadPublicCategoryLabels: jest.fn()}));

jest.mock('@/lib/branches/buildApprovedBusinessesQuery', () => ({
    buildApprovedBusinessesQuery: jest.fn(),
}));

import { buildApprovedBusinessesQuery } from '@/lib/branches/buildApprovedBusinessesQuery';

describe('branchesMapService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(loadPublicCategoryLabels).mockResolvedValue({wellness:'Wellness'});
    });

    test('returns a business query error without fetching category labels', async () => {
        jest.mocked(buildApprovedBusinessesQuery).mockReturnValue({limit:jest.fn().mockResolvedValue({data:null,error:{message:'unavailable'}})} as never);
        const result = await listBranchesMap({supabase:{from:jest.fn()} as never});
        expect(result).toMatchObject({ok:false,status:500});
        expect(loadPublicCategoryLabels).not.toHaveBeenCalled();
    });

    test('returns no category labels when there are no mapped branches', async () => {
        jest.mocked(buildApprovedBusinessesQuery).mockReturnValue({limit:jest.fn().mockResolvedValue({data:[{id:'b'}],error:null})} as never);
        const query = {limit:jest.fn().mockResolvedValue({data:[],error:null}),eq:jest.fn(),not:jest.fn(),in:jest.fn(),select:jest.fn()};
        query.select.mockReturnValue(query); query.in.mockReturnValue(query); query.not.mockReturnValue(query); query.eq.mockReturnValue(query);
        expect(await listBranchesMap({supabase:{from:()=>query} as never})).toEqual({ok:true,data:[]});
        expect(loadPublicCategoryLabels).not.toHaveBeenCalled();
    });

    test('uses the primary category name and safely handles missing metadata and numeric IDs', async () => {
        jest.mocked(buildApprovedBusinessesQuery).mockReturnValue({limit:jest.fn().mockResolvedValue({data:[
            {id:1,name:'Spa',slug:'spa',categories:['massage']},
            {id:2,name:null,slug:null,categories:null},
        ],error:null})} as never);
        jest.mocked(loadPublicCategoryLabels).mockResolvedValue({massage:'Massage'});
        const query = {limit:jest.fn().mockResolvedValue({data:[
            {id:11,biz_id:1,name:'Main',address:null,lat:40,lon:72},
            {id:12,biz_id:2,name:null,address:null,lat:'40',lon:'72'},
            {id:13,biz_id:99,name:null,address:null,lat:null,lon:null},
        ],error:null}),eq:jest.fn(),not:jest.fn(),in:jest.fn(),select:jest.fn()};
        query.select.mockReturnValue(query); query.in.mockReturnValue(query); query.not.mockReturnValue(query); query.eq.mockReturnValue(query);
        const result = await listBranchesMap({supabase:{from:()=>query} as never,onlyActive:false});
        expect(query.eq).not.toHaveBeenCalled();
        expect(result).toMatchObject({ok:true,data:[
            {id:'11',categoryId:'massage',categoryName:'Massage'},
            {id:'12',categoryId:null,categoryName:null,businessName:'',businessSlug:null,lat:40,lon:72},
            {id:'13',categoryId:null,categoryName:null,businessName:'',lat:0,lon:0},
        ]});
    });

    test('returns empty list when approved businesses query returns nothing', async () => {
        (buildApprovedBusinessesQuery as jest.Mock).mockReturnValue({
            limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
            }),
        });

        const result = await listBranchesMap({
            supabase: { from: jest.fn() } as never,
        });

        expect(result).toEqual({
            ok: true,
            data: [],
        });
    });

    test('maps branch items with business metadata', async () => {
        (buildApprovedBusinessesQuery as jest.Mock).mockReturnValue({
            limit: jest.fn().mockResolvedValue({
                data: [
                    {
                        id: 'biz-1',
                        name: 'Spa',
                        slug: 'spa',
                        categories: ['massage'],
                    },
                ],
                error: null,
            }),
        });

        const limit = jest.fn().mockResolvedValue({
            data: [
                {
                    id: 'branch-1',
                    name: 'Main branch',
                    address: 'Main st',
                    biz_id: 'biz-1',
                    lat: 42.8,
                    lon: 74.6,
                },
            ],
            error: null,
        });
        const eq = jest.fn().mockReturnValue({ limit });
        const not = jest.fn().mockReturnValue({ not: jest.fn().mockReturnValue({ eq, limit }) });
        const select = jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
                not,
            }),
        });

        const result = await listBranchesMap({
            supabase: {
                from: jest.fn().mockReturnValue({ select }),
            } as never,
            categoryId: 'wellness',
        });

        expect(result).toEqual({
            ok: true,
            data: [
                {
                    id: 'branch-1',
                    businessId: 'biz-1',
                    businessName: 'Spa',
                    businessSlug: 'spa',
                    branchName: 'Main branch',
                    address: 'Main st',
                    lat: 42.8,
                    lon: 74.6,
                    categoryId: 'wellness',
                    categoryName: 'Wellness',
                },
            ],
        });
    });

    test('returns internal error when branches query fails', async () => {
        (buildApprovedBusinessesQuery as jest.Mock).mockReturnValue({
            limit: jest.fn().mockResolvedValue({
                data: [
                    {
                        id: 'biz-1',
                        name: 'Spa',
                        slug: 'spa',
                        categories: ['massage'],
                    },
                ],
                error: null,
            }),
        });

        const limit = jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'branches failed' },
        });
        const eq = jest.fn().mockReturnValue({ limit });
        const not = jest.fn().mockReturnValue({ not: jest.fn().mockReturnValue({ eq, limit }) });
        const select = jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
                not,
            }),
        });

        const result = await listBranchesMap({
            supabase: {
                from: jest.fn().mockReturnValue({ select }),
            } as never,
        });

        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'Не удалось загрузить филиалы для карты',
            details: 'branches failed',
            status: 500,
        });
    });
});
