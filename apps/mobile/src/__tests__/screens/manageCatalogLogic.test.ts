import { createTranslate } from '../../i18n/translate';
import { manageMenuFor } from '../../screens/manage/manageMenu';
import {
    branchBookingUrl,
    branchFormFrom,
    buildBranchPayload,
    contactDisplayValue,
    contactHelperKey,
    formatGeocodedAddress,
    NEW_BRANCH_FORM,
    parseCoordinates,
    ratingAdviceKey,
} from '../../screens/manage/catalog/branchForm';
import {
    formatTimeInput,
    isValidScheduleDay,
    padTime,
    padWeek,
    scheduleWeek,
    withIntervals,
} from '../../screens/manage/catalog/branchSchedule';
import { catalogErrorText, hasBookingsMessage } from '../../screens/manage/catalog/catalogErrors';
import {
    buildPromotionPayload,
    changePromotionType,
    isOptionalDate,
    newPromotionForm,
    promotionFormFrom,
    promotionParamsText,
    promotionSaveErrorKey,
} from '../../screens/manage/catalog/promotions';
import {
    buildServicePayload,
    NEW_SERVICE_FORM,
    normalizeDurationInput,
    serviceFormFrom,
    toggleAllIds,
    toggleId,
    validateServiceForm,
} from '../../screens/manage/catalog/serviceForm';
import { timeZoneLabel, timeZoneOptions } from '../../screens/manage/catalog/settings';

const ru = createTranslate('ru');
const en = createTranslate('en');

const apiError = (status: number, body: Record<string, unknown>) =>
    Object.assign(new Error(String(body.message ?? body.error)), { status, details: body });

describe('manage menu (website /dashboard roles)', () => {
    test('services and branches for every managing role, settings for the owner only', () => {
        expect(manageMenuFor('owner').map((item) => item.key)).toEqual(expect.arrayContaining(['services', 'branches', 'settings']));
        for (const role of ['admin', 'manager'] as const) {
            const keys = manageMenuFor(role).map((item) => item.key);
            expect(keys).toEqual(expect.arrayContaining(['services', 'branches']));
            expect(keys).not.toContain('settings');
        }
    });
});

describe('service form (ServiceForm.tsx)', () => {
    const valid = { ...NEW_SERVICE_FORM, name_ru: 'Стрижка', branch_ids: ['b1'] };

    test('a new service starts at 60 minutes, active, without branches', () => {
        expect(NEW_SERVICE_FORM).toMatchObject({ duration_min: '60', active: true, branch_ids: [] });
    });

    test('the website checks with its texts', () => {
        expect(validateServiceForm(valid, ru)).toEqual({});
        const errors = validateServiceForm({
            ...NEW_SERVICE_FORM, name_ru: ' ', name_ky: 'x', duration_min: '0', price_from: '-1', price_to: '', branch_ids: [],
        }, ru);
        expect(errors).toEqual({
            nameRu: 'Название обязательно',
            nameKy: 'Введите от 2 до 100 символов',
            duration: 'Укажите целое число не менее 1 минуты',
            priceFrom: 'Цена не может быть отрицательной',
            branches: 'Выберите хотя бы один филиал',
        });
        expect(validateServiceForm({ ...valid, duration_min: '1.5' }, ru).duration).toBeTruthy();
        expect(validateServiceForm({ ...valid, duration_min: '' }, ru).duration).toBeTruthy();
        expect(validateServiceForm({ ...valid, price_from: '500', price_to: '300' }, ru).priceTo)
            .toBe('Минимальная цена не может быть больше максимальной');
        // A price only "from" is allowed.
        expect(validateServiceForm({ ...valid, price_from: '500', price_to: '' }, ru)).toEqual({});
        expect(validateServiceForm({ ...valid, branch_ids: [] }, en).branches).toBe('Select at least one branch');
    });

    test('payload: trimmed names, empty translations as null, numbers, service_id only on update', () => {
        const form = { ...valid, name_ru: ' Стрижка ', name_en: ' ', duration_min: '45', price_from: '500', price_to: '700,5' };
        expect(buildServicePayload(form)).toEqual({
            name_ru: 'Стрижка', name_ky: null, name_en: null, duration_min: 45, price_from: 500, price_to: 700.5,
            active: true, branch_ids: ['b1'],
        });
        expect(buildServicePayload(form, 's1')).toMatchObject({ service_id: 's1' });
    });

    test('edit form from the API; zero prices show empty', () => {
        const form = serviceFormFrom({
            service: { id: 's1', name_ru: 'Борода', name_ky: null, name_en: 'Beard', duration_min: 30, price_from: 0, price_to: 400, active: false, branch_id: 'b1' },
            branches: [], serviceBranchIds: ['b1', 'b2'],
        });
        expect(form).toEqual({
            name_ru: 'Борода', name_ky: '', name_en: 'Beard', duration_min: '30', price_from: '', price_to: '400',
            active: false, branch_ids: ['b1', 'b2'],
        });
    });

    test('branch selection helpers and the duration input', () => {
        expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
        expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
        expect(toggleAllIds(['a'], ['a', 'b'])).toEqual(['a', 'b']);
        expect(toggleAllIds(['a', 'b'], ['a', 'b'])).toEqual([]);
        expect(normalizeDurationInput('0045')).toBe('45');
        expect(normalizeDurationInput('0')).toBe('0');
    });
});

describe('branch form (BranchForm.tsx)', () => {
    const business = { contact_phone: '+996555000111', contact_whatsapp: null, contact_email: null, website_url: null };

    test('inherited contacts are shown, with the website hint; own values win', () => {
        const form = { ...NEW_BRANCH_FORM };
        expect(contactDisplayValue(form, 'contact_phone', business)).toBe('+996555000111');
        expect(contactHelperKey(form, 'contact_phone', business)).toBe('catalog.branches.form.contacts.inheritedValue');
        expect(contactHelperKey(form, 'contact_whatsapp', business)).toBe('catalog.branches.form.contacts.missingBusinessValue');
        const own = { ...form, contact_phone: '+996700000000' };
        expect(contactDisplayValue(own, 'contact_phone', business)).toBe('+996700000000');
        expect(contactHelperKey(own, 'contact_phone', business)).toBeNull();
        const notInheriting = { ...form, inherit_business_contacts: false };
        expect(contactDisplayValue(notInheriting, 'contact_phone', business)).toBe('');
        expect(contactHelperKey(notInheriting, 'contact_phone', business)).toBeNull();
    });

    test('coordinates: both or neither, in range, comma accepted', () => {
        expect(parseCoordinates('', '')).toEqual({ lat: null, lon: null });
        expect(parseCoordinates('42,87', '74.6')).toEqual({ lat: 42.87, lon: 74.6 });
        expect(parseCoordinates('42.87', '')).toBeNull();
        expect(parseCoordinates('91', '74')).toBeNull();
        expect(parseCoordinates('42', '181')).toBeNull();
        expect(parseCoordinates('abc', '74')).toBeNull();
    });

    test('payload has only the keys the strict update schema accepts', () => {
        const payload = buildBranchPayload({ ...NEW_BRANCH_FORM, name: ' Центр ', address: ' ', lat: '42.8', lon: '74.6' });
        expect(payload).toEqual({
            name: 'Центр', address: null, is_active: true, lat: 42.8, lon: 74.6,
            contact_phone: '', contact_whatsapp: '', contact_email: '', website_url: '', inherit_business_contacts: true,
        });
        expect(Object.keys(payload!)).not.toContain('id');
        expect(buildBranchPayload({ ...NEW_BRANCH_FORM, name: 'A', lat: '1' })).toBeNull();
    });

    test('edit form from the API', () => {
        const form = branchFormFrom({
            id: 'b1', name: 'Центр', address: null, is_active: false, lat: 42.8, lon: null, rating_score: null,
            inherit_business_contacts: false, contact_phone: null, contact_whatsapp: '+996', contact_email: null, website_url: null,
        });
        expect(form).toMatchObject({ address: '', lat: '42.8', lon: '', is_active: false, contact_whatsapp: '+996', inherit_business_contacts: false });
    });

    test('booking link, geocoded address and rating advice', () => {
        expect(branchBookingUrl('https://kezek.vercel.app/', 'low fade', 'b 1'))
            .toBe('https://kezek.vercel.app/b/low%20fade/booking?branch=b%201');
        expect(formatGeocodedAddress({ city: 'Бишкек', street: 'Чуй', streetNumber: '120' })).toBe('Бишкек, Чуй 120');
        expect(formatGeocodedAddress({ formattedAddress: ' Full ' })).toBe('Full');
        expect(formatGeocodedAddress(null)).toBe('');
        expect(ratingAdviceKey(null)).toBe('catalog.branch.rating.advice.noScore');
        expect(ratingAdviceKey(59.9)).toBe('catalog.branch.rating.advice.low');
        expect(ratingAdviceKey(60)).toBe('catalog.branch.rating.advice.medium');
        expect(ratingAdviceKey(80)).toBe('catalog.branch.rating.advice.high');
    });
});

describe('branch schedule (BranchScheduleEditor / scheduling model)', () => {
    test('seven days, Monday first, Sunday last; missing days are closed', () => {
        const week = scheduleWeek([{ day_of_week: 0, intervals: [{ start: '10:00', end: '16:00' }], breaks: [] }]);
        expect(week.map((day) => day.day_of_week)).toEqual([1, 2, 3, 4, 5, 6, 0]);
        expect(week[6].intervals).toEqual([{ start: '10:00', end: '16:00' }]);
        expect(week[0].intervals).toEqual([]);
    });

    test('the website validation rules', () => {
        const work = [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }];
        expect(isValidScheduleDay({ intervals: [], breaks: [] })).toBe(true);
        expect(isValidScheduleDay({ intervals: work, breaks: [{ start: '10:00', end: '10:30' }] })).toBe(true);
        expect(isValidScheduleDay({ intervals: [{ start: '18:00', end: '09:00' }], breaks: [] })).toBe(false);
        expect(isValidScheduleDay({ intervals: [work[1], work[0]], breaks: [] })).toBe(false);
        expect(isValidScheduleDay({ intervals: [{ start: '09:00', end: '12:00' }, { start: '11:00', end: '15:00' }], breaks: [] })).toBe(false);
        expect(isValidScheduleDay({ intervals: work, breaks: [{ start: '12:30', end: '14:30' }] })).toBe(false);
        expect(isValidScheduleDay({ intervals: [{ start: '9:00', end: '18:00' }], breaks: [] })).toBe(false);
        expect(isValidScheduleDay({ intervals: Array.from({ length: 9 }, (_, i) => ({ start: `0${i}:00`, end: `0${i}:30` })), breaks: [] })).toBe(false);
    });

    test('a closed day drops its breaks', () => {
        const day = { day_of_week: 1, intervals: [{ start: '09:00', end: '18:00' }], breaks: [{ start: '12:00', end: '13:00' }] };
        expect(withIntervals(day, []).breaks).toEqual([]);
        expect(withIntervals(day, day.intervals).breaks).toEqual(day.breaks);
    });

    test('typed digits become HH:MM', () => {
        expect(formatTimeInput('9')).toBe('9');
        expect(formatTimeInput('930')).toBe('9:30');
        expect(formatTimeInput('0930')).toBe('09:30');
        expect(formatTimeInput('09:3')).toBe('09:3');
        expect(padTime('9:30')).toBe('09:30');
        expect(padWeek([{ day_of_week: 1, intervals: [{ start: '9:00', end: '18:00' }], breaks: [] }])[0].intervals[0].start).toBe('09:00');
    });
});

describe('branch promotions (BranchPromotionsPanel.tsx)', () => {
    test('defaults: the type name as title, 7 visits, 20 % or 50 %', () => {
        expect(buildPromotionPayload(newPromotionForm(), ru)).toEqual({
            promotion_type: 'free_after_n_visits', params: { visit_count: 7 }, title_ru: 'Каждая N-я услуга бесплатно',
            is_active: true, valid_from: null, valid_to: null,
        });
        const referral = changePromotionType(newPromotionForm(), 'referral_discount_50');
        expect(referral.discount_percent).toBe('50');
        expect(buildPromotionPayload({ ...referral, discount_percent: '' }, ru).params).toEqual({ discount_percent: 50 });
        const first = changePromotionType(newPromotionForm(), 'first_visit_discount');
        expect(buildPromotionPayload({ ...first, discount_percent: '15', title_ru: ' Новым ', valid_from: '2026-12-01' }, ru))
            .toMatchObject({ params: { discount_percent: 15 }, title_ru: 'Новым', valid_from: '2026-12-01' });
        expect(buildPromotionPayload(changePromotionType(newPromotionForm(), 'referral_free'), ru).params).toEqual({});
    });

    test('editing keeps unknown params and the saved values', () => {
        const form = promotionFormFrom({
            id: 'p1', promotion_type: 'free_after_n_visits', params: { visit_count: 5, extra: 'x' }, title_ru: 'Пятый',
            is_active: false, valid_from: null, valid_to: '2026-12-31', created_at: '',
        });
        expect(form).toMatchObject({ visit_count: '5', extraParams: { extra: 'x' }, valid_to: '2026-12-31', is_active: false });
        expect(buildPromotionPayload(form, ru).params).toEqual({ extra: 'x', visit_count: 5 });
    });

    test('dates and API errors', () => {
        expect(isOptionalDate('')).toBe(true);
        expect(isOptionalDate('2026-02-28')).toBe(true);
        expect(isOptionalDate('2026-02-30')).toBe(false);
        expect(isOptionalDate('28.02.2026')).toBe(false);
        expect(promotionSaveErrorKey(apiError(400, { error: 'validation', details: { field: 'params.visit_count' } })))
            .toBe('catalog.branches.promotions.validation.visitCount');
        expect(promotionSaveErrorKey(apiError(400, { error: 'validation', details: { field: 'params.discount_percent' } })))
            .toBe('catalog.branches.promotions.validation.discount');
        expect(promotionSaveErrorKey(apiError(400, { error: 'validation' }))).toBe('catalog.branches.promotions.validation.general');
        expect(promotionSaveErrorKey(new Error('offline'))).toBe('catalog.branches.promotions.error.save');
    });

    test('card parameter lines', () => {
        const base = { id: 'p', title_ru: 'x', is_active: true, created_at: '' };
        expect(promotionParamsText({ ...base, promotion_type: 'free_after_n_visits', params: { visit_count: 7 } }, ru)).toBe('Каждая 7-я услуга бесплатно');
        expect(promotionParamsText({ ...base, promotion_type: 'birthday_discount', params: { discount_percent: 20 } }, en)).toBe('20% discount');
        expect(promotionParamsText({ ...base, promotion_type: 'referral_free', params: {} }, ru)).toBeNull();
    });
});

describe('errors', () => {
    test('a refused write shows the server message; other failures the app texts', () => {
        expect(catalogErrorText(apiError(409, { error: 'conflict', message: 'Достигнут лимит филиалов: 1 из 1.' }), 'x', ru))
            .toBe('Достигнут лимит филиалов: 1 из 1.');
        expect(catalogErrorText(apiError(500, { error: 'internal', message: 'boom' }), 'fallback', ru)).not.toBe('boom');
    });

    test('HAS_BOOKINGS lists the counts and examples like the website', () => {
        const error = apiError(400, {
            error: 'HAS_BOOKINGS', message: 'Нельзя удалить услугу',
            details: { total: 3, active: 1, cancelled: 2, bookings: [{ id: '12345678abcd', status: 'confirmed', client_name: 'Айбек' }] },
        });
        expect(hasBookingsMessage(error, 'service', ru)).toBe(
            'Нельзя удалить услугу\n\nВсего броней: 3\nАктивных: 1\nОтменённых: 2\n\nПримеры броней:\n- Бронь #12345678 (confirmed) - Айбек'
            + '\n\nСначала отмените или удалите все брони, связанные с этой услугой.',
        );
        expect(hasBookingsMessage(error, 'branch', ru)).toContain('Всего броней: 3');
        expect(hasBookingsMessage(apiError(400, { error: 'validation' }), 'service', ru)).toBeNull();
    });
});

describe('time zone select', () => {
    test('the short list, with an unlisted saved zone kept first', () => {
        expect(timeZoneOptions('Asia/Bishkek')[0]).toBe('Asia/Bishkek');
        expect(timeZoneOptions('Antarctica/Troll')[0]).toBe('Antarctica/Troll');
        expect(timeZoneLabel('Asia/Bishkek')).toBe('Asia/Bishkek (UTC+06:00)');
    });
});
