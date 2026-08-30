import { resolvePublicContacts, validatePublicContacts, whatsAppHref } from '@/lib/businessContacts';

describe('businessContacts', () => {
    it('normalizes business-owned public contacts', () => {
        expect(
            validatePublicContacts({
                contact_phone: ' +996 (555) 123-456 ',
                contact_whatsapp: '996 700 111 222',
                contact_email: ' HELLO@BUSINESS.KG ',
                website_url: 'https://business.kg',
            }),
        ).toEqual({
            ok: true,
            value: {
                contact_phone: '+996555123456',
                contact_whatsapp: '+996700111222',
                contact_email: 'hello@business.kg',
                website_url: 'https://business.kg/',
            },
        });
    });

    it('rejects unsafe website protocols', () => {
        const result = validatePublicContacts({ website_url: 'http://business.kg' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.field).toBe('website_url');
    });

    it('uses branch overrides and business fallbacks per field', () => {
        expect(
            resolvePublicContacts(
                { contact_phone: '+996555000000', contact_email: 'hello@business.kg' },
                { contact_phone: '+996700000000', inherit_business_contacts: true },
            ),
        ).toMatchObject({
            phone: '+996700000000',
            email: 'hello@business.kg',
            source: 'branch',
        });
    });

    it('does not leak business contacts when inheritance is disabled', () => {
        expect(
            resolvePublicContacts(
                { contact_phone: '+996555000000' },
                { inherit_business_contacts: false },
            ),
        ).toEqual({
            phone: null,
            whatsapp: null,
            email: null,
            website: null,
            source: 'none',
        });
    });

    it('builds a WhatsApp deep link without formatting symbols', () => {
        expect(whatsAppHref('+996 (700) 111-222')).toBe('https://wa.me/996700111222');
    });
});
