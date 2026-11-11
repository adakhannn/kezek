import {
    ensureSuperAdminAccess,
    getRatingsDebugEntities,
} from '@/lib/ratingsDebugEntitiesService';

describe('ratingsDebugEntitiesService', () => {
    test('returns forbidden when super admin row is missing', async () => {
        const rpc=jest.fn().mockResolvedValue({data:false,error:null});
        const result=await ensureSuperAdminAccess({supabase:{rpc},userId:'caller'});
        expect(rpc).toHaveBeenCalledWith('is_super_admin');

        expect(result).toEqual({
            ok: false,
            error: 'forbidden',
            message: 'Доступ запрещен',
            status: 403,
        });
    });

    test('returns internal error when super admin lookup fails', async () => {
        const rpc=jest.fn().mockResolvedValue({data:false,error:{message:'db failed'}});
        const result=await ensureSuperAdminAccess({supabase:{rpc},userId:'caller'});
        expect(rpc).toHaveBeenCalledWith('is_super_admin');

        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'Не удалось проверить права доступа',
            status: 400,
        });
    });

    test('aggregates null-rating and no-metrics diagnostics', async () => {
        const from = jest.fn((table: string) => {
            if (table === 'staff') {
                return {
                    select: jest.fn((columns: string) => {
                        if (columns.includes('last_rating_recalculated_at')) {
                            return {
                                is: jest.fn().mockReturnValue({
                                    order: jest.fn().mockResolvedValue({
                                        data: [{ id: 'staff-null' }],
                                    }),
                                }),
                            };
                        }
                        if (columns === 'id') {
                            return {
                                eq: jest.fn().mockResolvedValue({
                                    data: [{ id: 'staff-a' }, { id: 'staff-b' }],
                                }),
                            };
                        }
                        return {
                            in: jest.fn().mockResolvedValue({
                                data: [{ id: 'staff-b', full_name: 'Master', biz_id: 'biz-1', branch_id: 'branch-1' }],
                            }),
                        };
                    }),
                };
            }

            if (table === 'branches') {
                return {
                    select: jest.fn((columns: string) => {
                        if (columns.includes('last_rating_recalculated_at')) {
                            return {
                                is: jest.fn().mockReturnValue({
                                    order: jest.fn().mockResolvedValue({
                                        data: [{ id: 'branch-null' }],
                                    }),
                                }),
                            };
                        }
                        if (columns === 'id') {
                            return {
                                eq: jest.fn().mockResolvedValue({
                                    data: [{ id: 'branch-a' }],
                                }),
                            };
                        }
                        return {
                            in: jest.fn().mockResolvedValue({
                                data: [{ id: 'branch-a', name: 'Branch', biz_id: 'biz-1' }],
                            }),
                        };
                    }),
                };
            }

            if (table === 'businesses') {
                return {
                    select: jest.fn((columns: string) => {
                        if (columns.includes('last_rating_recalculated_at')) {
                            return {
                                is: jest.fn().mockReturnValue({
                                    order: jest.fn().mockResolvedValue({
                                        data: [{ id: 'biz-null' }],
                                    }),
                                }),
                            };
                        }
                        if (columns === 'id') {
                            return {
                                eq: jest.fn().mockResolvedValue({
                                    data: [{ id: 'biz-a' }],
                                }),
                            };
                        }
                        return {
                            in: jest.fn().mockResolvedValue({
                                data: [{ id: 'biz-a', name: 'Biz', slug: 'biz' }],
                            }),
                        };
                    }),
                };
            }

            if (table === 'staff_day_metrics') {
                return {
                    select: jest.fn().mockReturnValue({
                        gte: jest.fn().mockResolvedValue({
                            data: [{ staff_id: 'staff-a' }],
                        }),
                    }),
                };
            }

            if (table === 'branch_day_metrics') {
                return {
                    select: jest.fn().mockReturnValue({
                        gte: jest.fn().mockResolvedValue({
                            data: [],
                        }),
                    }),
                };
            }

            if (table === 'biz_day_metrics') {
                return {
                    select: jest.fn().mockReturnValue({
                        gte: jest.fn().mockResolvedValue({
                            data: [],
                        }),
                    }),
                };
            }

            if (table === 'rating_recalc_errors') {
                return {
                    select: jest.fn().mockReturnValue({
                        order: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue({
                                data: [{ id: 'err-1' }],
                            }),
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        const result = await getRatingsDebugEntities({
            admin: { from } as never,
            days: 7,
            windowStartStr: '2026-03-20',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                days: 7,
                window_since: '2026-03-20',
                with_null_rating: {
                    staff: [{ id: 'staff-null' }],
                    branches: [{ id: 'branch-null' }],
                    businesses: [{ id: 'biz-null' }],
                },
                without_metrics_since: {
                    staff: [{ id: 'staff-b', full_name: 'Master', biz_id: 'biz-1', branch_id: 'branch-1' }],
                    branches: [{ id: 'branch-a', name: 'Branch', biz_id: 'biz-1' }],
                    businesses: [{ id: 'biz-a', name: 'Biz', slug: 'biz' }],
                    total_count: {
                        staff: 1,
                        branches: 1,
                        businesses: 1,
                    },
                },
                recent_errors: [{ id: 'err-1' }],
            },
        });
    });
});
