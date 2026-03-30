import { diagnoseWhatsAppSetup } from '@/lib/whatsAppDiagnoseService';

describe('whatsAppDiagnoseService', () => {
    test('builds full successful diagnostics payload', async () => {
        const fetchImpl = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'user-id', name: 'Test User' }),
                text: async () => '',
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [{ id: 'business-account-id', name: 'Test Business' }],
                }),
                text: async () => '',
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [{ id: '123456789', verified_name: 'Test Business' }],
                }),
                text: async () => '',
            });

        const result = await diagnoseWhatsAppSetup({
            accessToken: 'test-token',
            phoneNumberId: '123456789',
            fetchImpl,
        });

        expect(result.summary).toEqual({
            tokenValid: true,
            hasBusinessAccounts: true,
            hasPhoneNumbers: true,
            phoneNumberIdValid: true,
        });
        expect(result.recommendations).toEqual([]);
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    test('returns token and permission recommendations on failing graph responses', async () => {
        const fetchImpl = jest
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                json: async () => ({}),
                text: async () => 'invalid token',
            })
            .mockResolvedValueOnce({
                ok: false,
                json: async () => ({}),
                text: async () => 'missing permission',
            });

        const result = await diagnoseWhatsAppSetup({
            accessToken: 'test-token',
            phoneNumberId: '123456789',
            fetchImpl,
        });

        expect(result.summary).toEqual({
            tokenValid: false,
            hasBusinessAccounts: false,
            hasPhoneNumbers: false,
            phoneNumberIdValid: false,
        });
        expect(result.recommendations).toEqual(
            expect.arrayContaining([
                expect.stringContaining('WHATSAPP_ACCESS_TOKEN'),
                expect.stringContaining('business_management'),
            ])
        );
    });
});
