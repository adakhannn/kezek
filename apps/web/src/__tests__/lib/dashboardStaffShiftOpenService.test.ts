import { runDashboardStaffShiftOpen } from '@/lib/dashboardStaffShiftOpenService';

describe('dashboardStaffShiftOpenService', () => {
    const supabase = {
        from: jest.fn(),
    };
    const admin = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns validation error when staff has no branch', async () => {
        const result = await runDashboardStaffShiftOpen({
            req: new Request('http://localhost/api/dashboard/staff/staff-id/shift/open'),
            supabase,
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
            staff: {
                branch_id: null,
            },
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message:
                'РЈ СЃРѕС‚СЂСѓРґРЅРёРєР° РЅРµ СѓРєР°Р·Р°РЅ С„РёР»РёР°Р». РЈРєР°Р¶РёС‚Рµ С„РёР»РёР°Р» РІ РєР°СЂС‚РѕС‡РєРµ СЃРѕС‚СЂСѓРґРЅРёРєР° Рё РїРѕРїСЂРѕР±СѓР№С‚Рµ СЃРЅРѕРІР°.',
        });
    });
});
