import {
    notifyBusinessApplicationApproved,
    notifyBusinessApplicationSubmitted,
    notifyOwnerApplicationApproved,
    notifyOwnerApplicationSubmitted,
    notifyStaffApplicationApproved,
    notifyStaffApplicationSubmitted,
    notifyStaffInvitationCreated,
} from '@/lib/businessRoleApplicationNotificationService';
import { sendEmail } from '@/lib/senders/email';
import { sendTelegram } from '@/lib/senders/telegram';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

// FE-10: role-application and invitation messages follow each recipient's preferred_locale on
// e-mail and Telegram; WhatsApp stays the approved Meta template.
jest.mock('@/lib/senders/telegram', () => ({ sendTelegram: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/senders/whatsapp', () => ({ sendWhatsApp: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/senders/email', () => ({ sendEmail: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

const original = process.env;
beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
        ...original, NODE_ENV: 'test', NEXT_PUBLIC_SITE_ORIGIN: 'https://example.invalid', WHATSAPP_APPLICATION_NAMED_PARAMETERS: '',
        WHATSAPP_STAFF_APPLICATION_OWNER_TEMPLATE_NAME: 'staff_owner_template',
        WHATSAPP_STAFF_APPLICATION_APPLICANT_TEMPLATE_NAME: 'staff_applicant_template',
    };
});
afterEach(() => { process.env = original; });

/** Every profile has e-mail and Telegram; `locales` gives preferred_locale by user id. */
function adminWith(locales: Record<string, string | null>, superAdmins: string[] = []) {
    const profileSelects: string[] = [];
    return {
        profileSelects,
        admin: {
            from(table: string) {
                let id = '';
                return {
                    select(columns: string) { if (table === 'profiles') profileSelects.push(columns); return this; },
                    eq(key: string, value: string) { if (key === 'id' || key === 'user_id') id = value; return this; },
                    async maybeSingle() {
                        if (table === 'businesses') return { data: { name: 'Salon <1>', owner_id: 'owner' } };
                        if (table === 'business_registration_applications') {
                            return { data: { applicant_user_id: 'applicant', contact_name: 'Eve', email: null, business_name: 'New <Biz>' } };
                        }
                        return { data: { notify_email: true, notify_telegram: true, telegram_verified: true, telegram_id: id.length,
                            notify_whatsapp: true, whatsapp_verified: true, whatsapp_phone: '+996555000000', preferred_locale: locales[id] } };
                    },
                    then(resolve: (value: unknown) => unknown) {
                        return Promise.resolve(resolve({ data: table === 'user_notification_emails' ? [{ email: `${id}@example.invalid` }] : [] }));
                    },
                };
            },
            rpc: jest.fn().mockResolvedValue({ data: superAdmins, error: null }),
            auth: { admin: { getUserById: jest.fn().mockResolvedValue({ data: { user: {} }, error: null }) } },
        },
    };
}

const applicant = { id: 'applicant', name: 'Eve & Co' };
const staffApplication = { id: 'application', businessId: 'biz', applicant };
const emails = () => (sendEmail as jest.Mock).mock.calls.map(([email]) => email);
const subjects = () => emails().map((email) => [email.to, email.subject]);

type Scenario = [string, (admin: ReturnType<typeof adminWith>['admin']) => Promise<unknown>, Record<'ky' | 'en', string[]>, string[]];
// name, run, expected subjects per locale (applicant first, then reviewers), expected link paths
const scenarios: Scenario[] = [
    ['staff application submitted', (admin) => notifyStaffApplicationSubmitted(admin, staffApplication), {
        ky: ['Kezek: «Salon <1>» бизнесине арызыңыз жөнөтүлдү', 'Kezek: «Salon <1>» бизнесине кызматкердин жаңы арызы'],
        en: ['Kezek: your application to “Salon <1>” has been sent', 'Kezek: new employee application to “Salon <1>”'],
    }, ['/business/staff-apply', '/dashboard/role-applications']],
    ['staff application approved', (admin) => notifyStaffApplicationApproved(admin, { applicantUserId: 'applicant', businessId: 'biz' }), {
        ky: ['Kezek: «Salon <1>» бизнесине кызматкер катары арызыңыз жактырылды'],
        en: ['Kezek: your employee application to “Salon <1>” has been approved'],
    }, ['/dashboard']],
    ['business application submitted', (admin) => notifyBusinessApplicationSubmitted(admin, { id: 'application', businessName: 'New <Biz>', applicant }), {
        ky: ['Kezek: «New <Biz>» бизнесин кошуу арызыңыз жөнөтүлдү', 'Kezek: «New <Biz>» бизнесин кошуунун жаңы арызы'],
        en: ['Kezek: your application to add “New <Biz>” has been sent', 'Kezek: new application to add “New <Biz>”'],
    }, ['/business/apply', '/admin/business-applications']],
    ['owner application submitted', (admin) => notifyOwnerApplicationSubmitted(admin, staffApplication), {
        ky: ['Kezek: «Salon <1>» бизнесинин ээси болуу арызыңыз жөнөтүлдү', 'Kezek: «Salon <1>» бизнесинин ээсинин жаңы арызы'],
        en: ['Kezek: your owner application for “Salon <1>” has been sent', 'Kezek: new owner application for “Salon <1>”'],
    }, ['/business/owner-apply', '/admin/role-applications']],
    ['business application approved', (admin) => notifyBusinessApplicationApproved(admin, { applicationId: 'application' }), {
        ky: ['Kezek: «New <Biz>» бизнеси кошулду'],
        en: ['Kezek: “New <Biz>” has been added'],
    }, ['/dashboard']],
    ['owner application approved', (admin) => notifyOwnerApplicationApproved(admin, { applicantUserId: 'applicant', businessId: 'biz' }), {
        ky: ['Kezek: «Salon <1>» бизнесинин ээсинин жеткилиги иштетилди'],
        en: ['Kezek: owner access to “Salon <1>” is active'],
    }, ['/dashboard']],
    ['staff invitation', (admin) => notifyStaffInvitationCreated(admin, { invitedUserId: 'applicant', businessName: 'Salon <1>', branchName: 'Center & 2' }), {
        ky: ['Kezek: «Salon <1>» командасына чакыруу'],
        en: ['Kezek: invitation to the “Salon <1>” team'],
    }, ['/cabinet']],
];

const RUSSIAN_WORDS = /заявк|приглаш|одобрен|отправлен|подключ|кабинет бизнеса|Рассмотреть|филиал «/;

describe.each(['ky', 'en'] as const)('%s recipients', (locale) => {
    test.each(scenarios)('%s: e-mail and Telegram are in the recipient language', async (_name, run, expected, paths) => {
        const { admin } = adminWith({ applicant: locale, owner: locale, 'admin-1': locale }, ['admin-1']);
        await run(admin);

        const sent = emails();
        expect(sent.map((email) => email.subject)).toEqual(expected[locale]);
        sent.forEach((email, index) => {
            expect(email.text).toContain(`https://example.invalid${paths[index]}`);
            expect(email.html).toContain(`href="https://example.invalid${paths[index]}"`);
            expect(email.html).not.toMatch(/<1>|<Biz>|Eve & Co/);
            expect(`${email.subject} ${email.text} ${email.html}`).not.toMatch(RUSSIAN_WORDS);
            if (locale === 'en') expect(`${email.subject} ${email.text} ${email.html}`).not.toMatch(/[А-Яа-яЁё]/);
        });
        const telegram = (sendTelegram as jest.Mock).mock.calls.map(([message]) => message.text);
        expect(telegram).toHaveLength(sent.length);
        telegram.forEach((text, index) => {
            expect(text).toContain(`https://example.invalid${paths[index]}`);
            expect(text).not.toMatch(RUSSIAN_WORDS);
            expect(text).not.toMatch(/<1>|<Biz>/);
        });
    });
});

test('Kyrgyz and English texts in full for the invitation, with the branch', async () => {
    for (const locale of ['ky', 'en'] as const) {
        jest.clearAllMocks();
        await notifyStaffInvitationCreated(adminWith({ applicant: locale }).admin, { invitedUserId: 'applicant', businessName: 'Salon <1>', branchName: 'Center & 2' });
        const [email] = emails();
        expect(email.text).toBe(locale === 'ky'
            ? '«Salon <1>» («Center & 2» филиалы) сизди командага чакырат. Чакырууну кабыл алуу же четке кагуу үчүн Kezek жеке кабинетиңизди ачыңыз: https://example.invalid/cabinet'
            : '“Salon <1>” (branch “Center & 2”) invites you to join the team. Open your Kezek account to accept or decline the invitation: https://example.invalid/cabinet');
        expect(email.html).toContain(locale === 'ky' ? '<b>Salon &lt;1&gt;</b> (<b>Center &amp; 2</b> филиалы) сизди командага чакырат.' : '<b>Salon &lt;1&gt;</b> (branch <b>Center &amp; 2</b>) invites you');
    }
});

test('each recipient gets their own language; null and unknown stay Russian', async () => {
    const { admin, profileSelects } = adminWith({ applicant: 'ky', owner: null });
    await notifyStaffApplicationSubmitted(admin, staffApplication);
    expect(profileSelects.every((columns) => columns.split(',').includes('preferred_locale'))).toBe(true);
    expect(subjects()).toEqual([
        ['applicant@example.invalid', 'Kezek: «Salon <1>» бизнесине арызыңыз жөнөтүлдү'],
        ['owner@example.invalid', 'Kezek: новая заявка сотрудника в «Salon <1>»'],
    ]);

    jest.clearAllMocks();
    await notifyBusinessApplicationSubmitted(adminWith({ applicant: 'de', 'admin-ky': 'ky', 'admin-en': 'en', 'admin-ru': null }, ['admin-ky', 'admin-en', 'admin-ru']).admin,
        { id: 'application', businessName: 'Biz', applicant });
    expect(subjects()).toEqual(expect.arrayContaining([
        ['applicant@example.invalid', 'Kezek: заявка на подключение «Biz» отправлена'],
        ['admin-ky@example.invalid', 'Kezek: «Biz» бизнесин кошуунун жаңы арызы'],
        ['admin-en@example.invalid', 'Kezek: new application to add “Biz”'],
        ['admin-ru@example.invalid', 'Kezek: новая заявка на подключение «Biz»'],
    ]));
    expect(subjects()).toHaveLength(4);
});

test('WhatsApp keeps the Meta template, the same for every language', async () => {
    const templates: Record<string, unknown> = {};
    for (const locale of ['ru', 'ky', 'en']) {
        jest.clearAllMocks();
        await notifyStaffApplicationSubmitted(adminWith({ applicant: locale, owner: locale }).admin, staffApplication);
        expect(sendWhatsApp).toHaveBeenCalledTimes(2);
        templates[locale] = (sendWhatsApp as jest.Mock).mock.calls.map(([message]) => message.template);
    }
    expect(templates.ky).toEqual(templates.ru);
    expect(templates.en).toEqual(templates.ru);
    expect(templates.ru).toEqual([
        expect.objectContaining({ name: 'staff_applicant_template' }),
        expect.objectContaining({ name: 'staff_owner_template' }),
    ]);
});
