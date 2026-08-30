import EditBranchPage from '@/app/dashboard/branches/[id]/page';
import EditBranchPageClient from '@/app/dashboard/branches/[id]/EditBranchPageClient';
import { getBizContextForManagers } from '@/lib/authBiz';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
    logError: jest.fn(),
}));

jest.mock('@/app/dashboard/branches/[id]/EditBranchPageClient', () => ({
    __esModule: true,
    default: jest.fn(() => null),
}));

describe('EditBranchPage data loading', () => {
    it('scopes the branch to the current business and loads business data without an embedded join', async () => {
        const previousMapKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
        process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY = 'test-map-key';
        const branchSelect = jest.fn();
        const branchEqBiz = jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
                data: {
                    id: 'branch-1',
                    biz_id: 'biz-1',
                    name: 'Main branch',
                    address: 'Osh',
                    is_active: true,
                    lat: 40.5,
                    lon: 72.8,
                    rating_score: null,
                    contact_phone: null,
                    contact_whatsapp: null,
                    contact_email: null,
                    website_url: null,
                    inherit_business_contacts: true,
                },
                error: null,
            }),
        }));
        const branchEqId = jest.fn(() => ({ eq: branchEqBiz }));
        branchSelect.mockReturnValue({ eq: branchEqId });

        const businessMaybeSingle = jest.fn().mockResolvedValue({
            data: {
                slug: 'test-business',
                name: 'Test business',
                contact_phone: '+996555000001',
                contact_whatsapp: '+996555000002',
                contact_email: 'business@example.com',
                website_url: 'https://example.com',
            },
            error: null,
        });
        const businessEq = jest.fn(() => ({ maybeSingle: businessMaybeSingle }));
        const businessSelect = jest.fn(() => ({ eq: businessEq }));

        const ratingMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
        const ratingLimit = jest.fn(() => ({ maybeSingle: ratingMaybeSingle }));
        const ratingOrder = jest.fn(() => ({ limit: ratingLimit }));
        const ratingEq = jest.fn(() => ({ order: ratingOrder }));
        const ratingSelect = jest.fn(() => ({ eq: ratingEq }));

        const from = jest.fn((table: string) => {
            if (table === 'branches') return { select: branchSelect };
            if (table === 'businesses') return { select: businessSelect };
            if (table === 'rating_global_config') return { select: ratingSelect };
            if (table === 'branch_working_hours') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            eq: jest.fn(() => ({
                                order: jest.fn().mockResolvedValue({ data: [], error: null }),
                            })),
                        })),
                    })),
                };
            }
            throw new Error(`Unexpected table: ${table}`);
        });

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId: 'biz-1',
            supabase: {
                rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
                from,
            },
        });

        const element = await EditBranchPage({ params: Promise.resolve({ id: 'branch-1' }) });

        expect(branchSelect).toHaveBeenCalledWith(expect.not.stringContaining('businesses'));
        expect(branchEqId).toHaveBeenCalledWith('id', 'branch-1');
        expect(branchEqBiz).toHaveBeenCalledWith('biz_id', 'biz-1');
        expect(businessEq).toHaveBeenCalledWith('id', 'biz-1');
        expect(element.type).toBe(EditBranchPageClient);
        expect(element.props).toMatchObject({
            bizId: 'biz-1',
            bizSlug: 'test-business',
            bizName: 'Test business',
            businessContacts: {
                contact_phone: '+996555000001',
                contact_whatsapp: '+996555000002',
                contact_email: 'business@example.com',
                website_url: 'https://example.com',
            },
            yandexMapsApiKey: 'test-map-key',
        });

        if (previousMapKey === undefined) delete process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
        else process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY = previousMapKey;
    });
});
