import { getServiceName, formatStaffName, getStatusColorWeb, getStatusColorMobile, getStatusText } from './i18n';

describe('shared-client/i18n', () => {
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

