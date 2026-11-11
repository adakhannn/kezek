import { updateBusinessContactSettings } from '@/lib/businessContactSettingsService';

describe('businessContactSettingsService', () => {
    test('updates only the provided contact and preserves all others', async () => {
        const query = {
            update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: { contact_email: null, contact_phone: '+996555000000' }, error: null }),
        };
        const admin = { from: jest.fn().mockReturnValue(query) };
        expect(await updateBusinessContactSettings({ admin, bizId: 'biz-1', input: { contact_email: null } })).toMatchObject({ ok: true });
        expect(query.update).toHaveBeenCalledWith({ contact_email: null });
        expect(query.eq).toHaveBeenCalledWith('id', 'biz-1');
    });

    test.each([null, [], {}, 42, { contact_email: false }, { website_url: 'http://unsafe.example' }, { unknown: 'value' }])(
        'rejects invalid input before any write: %j', async (input) => {
            const admin = { from: jest.fn() };
            expect(await updateBusinessContactSettings({ admin, bizId: 'biz-1', input })).toMatchObject({ ok: false, status: 400 });
            expect(admin.from).not.toHaveBeenCalled();
        },
    );
});
