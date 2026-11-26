import {
    getServiceName,
    getLocalizedText,
    getPromotionTitle,
    formatStaffName,
    getStatusColorWeb,
    getStatusColorMobile,
    getStatusText,
} from './i18n';

describe('shared-client/i18n', () => {
    test('getServiceName: blank ky/en names fall back to ru; a missing ru name never prints "undefined"', () => {
        expect(getServiceName({ name_ru: 'Стрижка', name_ky: '  ', name_en: '' }, 'ky')).toBe('Стрижка');
        expect(getServiceName({ name_ru: ' Стрижка ', name_ky: ' Кесим ' }, 'ky')).toBe('Кесим');
        expect(getServiceName({ name_ru: null, name_ky: 'Кесим' }, 'ru')).toBe('Кесим');
        expect(getServiceName({ name_ru: null }, 'en')).toBe('');
        expect(getServiceName({ name_ru: '' }, 'ru')).toBe('');
        expect(getServiceName(null, 'ky')).toBe('');
    });

    test('getLocalizedText and getPromotionTitle: the chosen language, else ru, without transliteration', () => {
        const text = { ru: 'Скидка', ky: 'Арзандатуу', en: 'Discount' };
        expect(getLocalizedText(text, 'ru')).toBe('Скидка');
        expect(getLocalizedText(text, 'ky')).toBe('Арзандатуу');
        expect(getLocalizedText(text, 'en')).toBe('Discount');
        expect(getLocalizedText({ ru: 'Скидка', en: ' ' }, 'en')).toBe('Скидка');
        expect(getLocalizedText({ ru: null, en: 'Discount' }, 'ky')).toBe('Discount');
        expect(getLocalizedText(null, 'en')).toBe('');

        expect(getPromotionTitle({ title_ru: 'Акция', title_ky: 'Акция ky', title_en: null }, 'ky')).toBe('Акция ky');
        expect(getPromotionTitle({ title_ru: 'Акция', title_ky: null, title_en: null }, 'en')).toBe('Акция');
        expect(getPromotionTitle(undefined, 'ru')).toBe('');
    });

    test('getServiceName учитывает locale и транслитерацию', () => {
        const service = { name_ru: 'Стрижка', name_ky: 'Кесим', name_en: 'Haircut' };

        expect(getServiceName(service, 'ru')).toBe('Стрижка');
        expect(getServiceName(service, 'ky')).toBe('Кесим');
        expect(getServiceName(service, 'en')).toBe('Haircut');

        const withoutEn = { name_ru: 'Маникюр', name_ky: null, name_en: null };
        expect(getServiceName(withoutEn, 'en')).toMatch(/Manik/);

        expect(getServiceName('Свободная форма', 'ru')).toBe('Свободная форма');
    });

    test('formatStaffName транслитерирует только для en', () => {
        expect(formatStaffName('Иван Петров', 'ru')).toBe('Иван Петров');
        expect(formatStaffName('Иван Петров', 'en')).toBe('Ivan Petrov');
        expect(formatStaffName(null, 'ru')).toBe('');
    });

    test('getStatusColorWeb и getStatusColorMobile возвращают конфигурации для известных статусов', () => {
        const webConfig = getStatusColorWeb('confirmed');
        expect(webConfig.className).toContain('blue');

        const mobileColor = getStatusColorMobile('paid');
        expect(mobileColor).toMatch(/^#/);

        const fallbackWeb = getStatusColorWeb('unknown-status');
        expect(fallbackWeb).toBeDefined();

        const fallbackMobile = getStatusColorMobile('unknown-status');
        expect(fallbackMobile).toBe('#6b7280');
    });

    test('getStatusText возвращает переводы для разных языков и fallback для неизвестного статуса', () => {
        expect(getStatusText('hold', 'ru')).toBe('В ожидании');
        expect(getStatusText('paid', 'en')).toBe('Completed');
        expect(getStatusText('no_show', 'ky')).toBe('Келген жок');

        expect(getStatusText('UNKNOWN_STATUS', 'ru')).toBe('UNKNOWN_STATUS');
    });
});

