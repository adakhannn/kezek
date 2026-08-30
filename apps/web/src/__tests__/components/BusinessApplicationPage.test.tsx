import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

import BusinessApplicationPage from '@/app/business/apply/page';
import { BusinessApplicationPageContent } from '@/app/business/apply/BusinessApplicationPageContent';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

describe('BusinessApplicationPage data access', () => {
    it('loads authenticated page data through the user-scoped SSR client', async () => {
        const categoriesResult = {
            data: [{ slug: 'barbershop', name_ru: 'Барбершоп' }],
            error: null,
        };
        const profileResult = {
            data: {
                full_name: 'Тестовый владелец',
                phone: null,
                whatsapp_phone: '+996700000000',
                whatsapp_verified: true,
            },
            error: null,
        };
        const notificationEmailsResult = {
            data: [{ email: 'owner@example.com', verified: true, enabled: true }],
            error: null,
        };
        const from = jest.fn((table: string) => {
            if (table === 'categories') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn().mockResolvedValue(categoriesResult),
                        })),
                    })),
                };
            }
            if (table === 'profiles') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            maybeSingle: jest.fn().mockResolvedValue(profileResult),
                        })),
                    })),
                };
            }
            if (table === 'user_notification_emails') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            eq: jest.fn().mockResolvedValue(notificationEmailsResult),
                        })),
                    })),
                };
            }
            throw new Error(`Unexpected table: ${table}`);
        });

        (createSupabaseServerClient as jest.Mock).mockResolvedValue({
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: {
                        user: {
                            id: 'user-1',
                            email: 'account@example.com',
                            phone: null,
                            user_metadata: {},
                        },
                    },
                }),
            },
            from,
        });

        const element = await BusinessApplicationPage();

        expect(element.type).toBe(BusinessApplicationPageContent);
        expect(from.mock.calls.map(([table]) => table)).toEqual([
            'categories',
            'profiles',
            'user_notification_emails',
        ]);
        expect(element.props).toMatchObject({
            isAuthenticated: true,
            categories: [{ slug: 'barbershop', name: 'Барбершоп' }],
            initialValues: {
                contact_name: 'Тестовый владелец',
                phone: '+996700000000',
                email: 'account@example.com',
            },
        });
    });
});
