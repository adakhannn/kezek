/**
 * The super-admin panel's rules, as the website applies them (apps/web/src/app/admin/**).
 */
import type { AdminBusinessApplication, AdminBusinessListItem } from '../../../screens/admin/adminApi';
import {
    adminBranchFormFrom,
    applicationCategory,
    availableRoles,
    buildAdminBranchPayload,
    businessCounts,
    businessSetup,
    canModerateBusinessApplication,
    canSubmitManualBusiness,
    clampBranchLimit,
    filterBusinessApplications,
    filterBusinesses,
    filterRoles,
    isE164OrEmpty,
    isEmailOrEmpty,
    isValidCategorySlug,
    isValidRoleKey,
    makeCategorySlug,
    NEW_ADMIN_BRANCH,
    ownersChanged,
    pageCount,
    parsePhonesText,
    reviewHistory,
    slugifyBusinessName,
    todayStatusCounts,
    userLabel,
} from '../../../screens/admin/adminLogic';
import { ADMIN_MENU } from '../../../screens/admin/adminMenu';

const business = (patch: Partial<AdminBusinessListItem>): AdminBusinessListItem => ({
    id: 'b',
    slug: 'low-fade',
    name: 'Low Fade',
    owner_id: null,
    created_at: null,
    is_approved: true,
    categories: ['barbershop'],
    address: 'Бишкек, Чуй 120',
    owner_name: 'Айбек',
    branches_count: 1,
    staff_count: 2,
    ...patch,
});

describe('slugs', () => {
    test('a business name becomes its /b/ address as on the website', () => {
        expect(slugifyBusinessName('Барбершоп Ңур №1')).toBe('barbershop-ngur-1');
        expect(slugifyBusinessName('  Цирюльня  ')).toBe('ciryulnya');
        expect(slugifyBusinessName('!!!')).toBe('business');
        expect(slugifyBusinessName('a'.repeat(100))).toHaveLength(80);
    });

    test('a category slug may be empty; the category form transliterates ц as ts', () => {
        expect(makeCategorySlug('Цветы и Ногти')).toBe('tsvety-i-nogti');
        expect(makeCategorySlug('')).toBe('');
        expect(isValidCategorySlug('')).toBe(true);
        expect(isValidCategorySlug('nails')).toBe(true);
        expect(isValidCategorySlug('a')).toBe(false);
        expect(isValidCategorySlug('Nails')).toBe(false);
    });

    test('a role key is [a-z0-9_-], 2 to 32 characters', () => {
        expect(isValidRoleKey('branch_operator')).toBe(true);
        expect(isValidRoleKey('x')).toBe(false);
        expect(isValidRoleKey('Оператор')).toBe(false);
        expect(isValidRoleKey('a'.repeat(33))).toBe(false);
    });
});

describe('businesses', () => {
    const items = [
        business({ id: '1', name: 'Low Fade' }),
        business({ id: '2', name: 'Nail Bar', slug: 'nail-bar', is_approved: false, owner_name: null, categories: ['nails'] }),
        business({ id: '3', name: 'Spa', slug: 'spa', is_approved: null, address: null }),
    ];

    test('search covers name, slug, address, owner and categories; status splits approved and moderation', () => {
        expect(filterBusinesses(items, 'nails', 'all').map((item) => item.id)).toEqual(['2']);
        expect(filterBusinesses(items, 'айбек', 'all').map((item) => item.id)).toEqual(['1', '3']);
        expect(filterBusinesses(items, '', 'moderation').map((item) => item.id)).toEqual(['2', '3']);
        expect(filterBusinesses(items, '', 'approved').map((item) => item.id)).toEqual(['1']);
        expect(businessCounts(items)).toEqual({ total: 3, approved: 1, moderation: 2 });
    });

    test('the readiness checklist counts what is done', () => {
        const setup = businessSetup({ approved: true, hasOwner: false, branches: 2, services: 0 });
        expect(setup.done).toBe(2);
        expect(setup.items.map((item) => [item.key, item.complete])).toEqual([
            ['approved', true], ['owner', false], ['branch', true], ['services', false],
        ]);
    });

    test('phones are one per line; the branch limit stays within 1..1000 and above the current count', () => {
        expect(parsePhonesText(' +996555 \n\n+996700 ')).toEqual(['+996555', '+996700']);
        expect(parsePhonesText('  ')).toBeNull();
        expect(clampBranchLimit('3', 2)).toBe(3);
        expect(clampBranchLimit('1', 2)).toBeNull();
        expect(clampBranchLimit('0', 0)).toBeNull();
        expect(clampBranchLimit('1001', 0)).toBeNull();
        expect(clampBranchLimit('abc', 0)).toBeNull();
    });

    test('manual creation needs a name, address, a category, a 10-character reason and the acknowledgement', () => {
        const ready = { name: 'Low Fade', slug: 'low-fade', categories: ['barbershop'], reason: 'Перенос клиента из CRM', acknowledged: true };
        expect(canSubmitManualBusiness(ready)).toBe(true);
        expect(canSubmitManualBusiness({ ...ready, reason: 'коротко' })).toBe(false);
        expect(canSubmitManualBusiness({ ...ready, categories: [] })).toBe(false);
        expect(canSubmitManualBusiness({ ...ready, acknowledged: false })).toBe(false);
        expect(canSubmitManualBusiness({ ...ready, name: 'A' })).toBe(false);
    });
});

describe('branches', () => {
    test('the admin branch form sends both coordinates or neither, and the directory links', () => {
        const form = adminBranchFormFrom({
            id: 'br', biz_id: 'b', name: 'Центр', address: null, is_active: true, lat: 42.87, lon: 74.59,
            directory_links: { two_gis: 'https://2gis.kg/x' }, contact_phone: null, contact_whatsapp: null,
            contact_email: null, website_url: null, inherit_business_contacts: null,
        });
        expect(form.links).toEqual({ instagram: '', two_gis: 'https://2gis.kg/x', google_maps: '', yandex_maps: '' });
        expect(form.inherit_business_contacts).toBe(true);
        expect(buildAdminBranchPayload({ ...form, name: ' Центр ' })).toEqual(expect.objectContaining({
            name: 'Центр', address: null, lat: 42.87, lon: 74.59,
            directory_links: { instagram: '', two_gis: 'https://2gis.kg/x', google_maps: '', yandex_maps: '' },
        }));
        expect(buildAdminBranchPayload({ ...NEW_ADMIN_BRANCH, lat: '42,5', lon: '' })).toBeNull();
        expect(buildAdminBranchPayload({ ...NEW_ADMIN_BRANCH, lat: '95', lon: '74' })).toBeNull();
        expect(buildAdminBranchPayload({ ...NEW_ADMIN_BRANCH, lat: '42,5', lon: '74.1' })).toEqual(expect.objectContaining({ lat: 42.5, lon: 74.1 }));
    });
});

describe('people and roles', () => {
    test('a member is offered the roles they lack, in the website order', () => {
        expect(availableRoles(['staff', 'client'])).toEqual(['owner', 'admin', 'manager']);
        expect(availableRoles([])).toEqual(['owner', 'admin', 'manager', 'staff', 'client']);
    });

    test('an owner list is changed only by membership, not order', () => {
        expect(ownersChanged([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'a' }])).toBe(false);
        expect(ownersChanged([{ id: 'a' }], [{ id: 'a' }, { id: 'c' }])).toBe(true);
        expect(ownersChanged([{ id: 'a' }], [{ id: 'c' }])).toBe(true);
    });

    test('labels, contacts and validation of the user form', () => {
        expect(userLabel({ id: 'u1', full_name: 'Айбек', email: 'a@b.kg', phone: null })).toBe('Айбек • a@b.kg');
        expect(userLabel({ id: 'u1', full_name: null, email: null, phone: null })).toBe('u1');
        expect(isE164OrEmpty('')).toBe(true);
        expect(isE164OrEmpty('+996555123456')).toBe(true);
        expect(isE164OrEmpty('0555123456')).toBe(false);
        expect(isEmailOrEmpty('a@b.kg')).toBe(true);
        expect(isEmailOrEmpty('a@b')).toBe(false);
        expect(pageCount(0, 20)).toBe(1);
        expect(pageCount(41, 20)).toBe(3);
    });

    test('roles are searched by key, name and description', () => {
        const roles = [
            { id: '1', key: 'owner', name: 'Владелец', is_system: true },
            { id: '2', key: 'operator', name: 'Оператор', description: 'Филиал', is_system: false },
        ];
        expect(filterRoles(roles, 'филиал').map((role) => role.id)).toEqual(['2']);
        expect(filterRoles(roles, ' ').map((role) => role.id)).toEqual(['1', '2']);
    });
});

describe('applications and bookings', () => {
    const application = (patch: Partial<AdminBusinessApplication>): AdminBusinessApplication => ({
        id: 'a', contact_name: 'Айбек', phone: '+996555', email: null, business_name: 'Low Fade', category: 'barbershop',
        comment: null, status: 'new', applicant_user_id: null, created_at: '2026-11-20T10:00:00Z', created_business_id: null,
        directory_links: null, prior_submission_count: 0, risk_flags: [], ...patch,
    });

    test('a category is known by slug or name; an unknown one is proposed and blocks approval', () => {
        const names = { barbershop: 'Барбершоп', 'барбершоп': 'Барбершоп' };
        expect(applicationCategory(application({ category: 'BarberShop' }), names)).toEqual({ raw: 'BarberShop', known: 'Барбершоп', proposed: false });
        expect(applicationCategory(application({ category: 'Тату' }), names)).toEqual({ raw: 'Тату', known: null, proposed: true });
        expect(applicationCategory(application({ category: null }), names)).toEqual({ raw: '', known: null, proposed: false });
    });

    test('only new and contacted applications are moderated; filters by status and text', () => {
        expect(canModerateBusinessApplication('new')).toBe(true);
        expect(canModerateBusinessApplication('contacted')).toBe(true);
        expect(canModerateBusinessApplication('approved')).toBe(false);
        const items = [application({ id: '1' }), application({ id: '2', status: 'rejected', business_name: 'Nail Bar' })];
        expect(filterBusinessApplications(items, 'new', '').map((item) => item.id)).toEqual(['1']);
        expect(filterBusinessApplications(items, 'all', 'nail').map((item) => item.id)).toEqual(['2']);
    });

    test('review history speaks only when there is something to say', () => {
        expect(reviewHistory(0, [])).toBeNull();
        expect(reviewHistory(2, [])).toEqual({ repeated: true, rejected: false, other: false });
        expect(reviewHistory(0, ['prior_rejection', 'odd_flag'])).toEqual({ repeated: false, rejected: true, other: true });
    });

    test('today\'s bookings are counted by status, cancelled and canceled together', () => {
        expect(todayStatusCounts([{ status: 'hold' }, { status: 'confirmed' }, { status: 'canceled' }, { status: 'cancelled' }]))
            .toEqual({ hold: 1, confirmed: 1, cancelled: 2 });
    });
});

test('the admin menu is a plain list of sections with unique keys and admin routes', () => {
    expect(ADMIN_MENU.map((item) => item.key)).toEqual(['businesses', 'businessApplications', 'roleApplications', 'users', 'roles', 'categories']);
    expect(new Set(ADMIN_MENU.map((item) => item.route)).size).toBe(ADMIN_MENU.length);
    ADMIN_MENU.forEach((item) => expect(item.route.startsWith('Admin')).toBe(true));
});
