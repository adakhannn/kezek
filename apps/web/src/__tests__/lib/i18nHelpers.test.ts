/**
 * Unit-тесты для утилит локализации
 * Тестирует getServiceName, formatStaffName и getStatusColor
 */

import { getServiceName, formatStaffName, getStatusColor, type ServiceName, type BookingStatus } from '@/lib/i18nHelpers';

describe('i18nHelpers', () => {
    describe('getServiceName', () => {
        const serviceWithAllLanguages: ServiceName = {
            name_ru: 'Стрижка',
            name_ky: 'Кесим',
            name_en: 'Haircut',
        };

        const serviceWithRussianOnly: ServiceName = {
            name_ru: 'Окрашивание',
            name_ky: null,
            name_en: null,
        };

        const serviceWithRussianAndKyrgyz: ServiceName = {
            name_ru: 'Маникюр',
            name_ky: 'Маникюр',
            name_en: null,
        };

        test('должен возвращать name_ru для русского языка', () => {
            expect(getServiceName(serviceWithAllLanguages, 'ru')).toBe('Стрижка');
            expect(getServiceName(serviceWithRussianOnly, 'ru')).toBe('Окрашивание');
        });

        test('должен возвращать name_ky для киргизского языка, если доступно', () => {
            expect(getServiceName(serviceWithAllLanguages, 'ky')).toBe('Кесим');
            expect(getServiceName(serviceWithRussianAndKyrgyz, 'ky')).toBe('Маникюр');
        });

        test('должен возвращать name_ru для киргизского языка, если name_ky отсутствует', () => {
            expect(getServiceName(serviceWithRussianOnly, 'ky')).toBe('Окрашивание');
        });

        test('должен возвращать name_en для английского языка, если доступно', () => {
            expect(getServiceName(serviceWithAllLanguages, 'en')).toBe('Haircut');
        });

        test('должен транслитерировать name_ru для английского языка, если name_en отсутствует', () => {
            const result = getServiceName(serviceWithRussianOnly, 'en');
            expect(result).toBe('Okrashivanie'); // Транслитерация "Окрашивание"
            expect(result).not.toBe('Окрашивание'); // Не должно быть кириллицей
        });

        test('должен обрабатывать строку как вручную введенное название', () => {
            expect(getServiceName('Стрижка', 'ru')).toBe('Стрижка');
            expect(getServiceName('Стрижка', 'ky')).toBe('Стрижка');
            expect(getServiceName('Стрижка', 'en')).toBe('Strizhka'); // Транслитерация
        });

        test('должен возвращать пустую строку для null или undefined', () => {
            expect(getServiceName(null, 'ru')).toBe('');
            expect(getServiceName(undefined, 'ru')).toBe('');
        });

        test('должен корректно обрабатывать пустые строки в полях', () => {
            const serviceWithEmptyFields: ServiceName = {
                name_ru: 'Услуга',
                name_ky: '',
                name_en: '',
            };
            expect(getServiceName(serviceWithEmptyFields, 'ky')).toBe('Услуга'); // Fallback на name_ru
            expect(getServiceName(serviceWithEmptyFields, 'en')).toBe('Usluga'); // Транслитерация
        });
    });

    describe('formatStaffName', () => {
        test('должен возвращать имя как есть для русского языка', () => {
            expect(formatStaffName('Иван Петров', 'ru')).toBe('Иван Петров');
            expect(formatStaffName('Айгерим', 'ru')).toBe('Айгерим');
        });

        test('должен возвращать имя как есть для киргизского языка', () => {
            expect(formatStaffName('Иван Петров', 'ky')).toBe('Иван Петров');
            expect(formatStaffName('Айгерим', 'ky')).toBe('Айгерим');
        });

        test('должен транслитерировать имя для английского языка', () => {
            expect(formatStaffName('Иван Петров', 'en')).toBe('Ivan Petrov');
            expect(formatStaffName('Айгерим', 'en')).toBe('Aygerim'); // Проверяем реальную транслитерацию
        });

        test('должен возвращать пустую строку для null или undefined', () => {
            expect(formatStaffName(null, 'ru')).toBe('');
            expect(formatStaffName(null, 'en')).toBe('');
            expect(formatStaffName(undefined, 'ru')).toBe('');
            expect(formatStaffName(undefined, 'en')).toBe('');
        });

        test('должен корректно обрабатывать пустую строку', () => {
            expect(formatStaffName('', 'ru')).toBe('');
            expect(formatStaffName('', 'en')).toBe('');
        });

        test('должен корректно транслитерировать сложные имена', () => {
            expect(formatStaffName('Александр', 'en')).toBe('Aleksandr');
            expect(formatStaffName('Елена', 'en')).toBe('Elena');
            expect(formatStaffName('Юлия', 'en')).toBe('Yuliya');
        });
    });

    describe('getStatusColor', () => {
        test('должен возвращать правильную конфигурацию для статуса "hold"', () => {
            const config = getStatusColor('hold');
            expect(config.bgColor).toBe('yellow');
            expect(config.textColor).toBe('yellow');
            expect(config.borderColor).toBe('yellow');
            expect(config.className).toContain('yellow');
        });

        test('должен возвращать правильную конфигурацию для статуса "confirmed"', () => {
            const config = getStatusColor('confirmed');
            expect(config.bgColor).toBe('blue');
            expect(config.textColor).toBe('blue');
            expect(config.borderColor).toBe('blue');
            expect(config.className).toContain('blue');
        });

        test('должен возвращать правильную конфигурацию для статуса "paid"', () => {
            const config = getStatusColor('paid');
            expect(config.bgColor).toBe('green');
            expect(config.textColor).toBe('green');
            expect(config.borderColor).toBe('green');
            expect(config.className).toContain('green');
        });

        test('должен возвращать правильную конфигурацию для статуса "cancelled"', () => {
            const config = getStatusColor('cancelled');
            expect(config.bgColor).toBe('gray');
            expect(config.textColor).toBe('gray');
            expect(config.borderColor).toBe('gray');
            expect(config.className).toContain('gray');
        });

        test('должен возвращать правильную конфигурацию для статуса "no_show"', () => {
            const config = getStatusColor('no_show');
            expect(config.bgColor).toBe('red');
            expect(config.textColor).toBe('red');
            expect(config.borderColor).toBe('red');
            expect(config.className).toContain('red');
        });

        test('должен возвращать конфигурацию для cancelled (дефолт) для неизвестного статуса', () => {
            const config = getStatusColor('unknown_status' as BookingStatus);
            expect(config.bgColor).toBe('gray');
            expect(config.textColor).toBe('gray');
            expect(config.borderColor).toBe('gray');
        });

        test('должен включать dark mode классы в className', () => {
            const config = getStatusColor('hold');
            expect(config.className).toContain('dark:bg-yellow-900/30');
            expect(config.className).toContain('dark:text-yellow-400');
        });

        test('должен включать border классы в className', () => {
            const config = getStatusColor('confirmed');
            expect(config.className).toContain('border-blue-300');
            expect(config.className).toContain('dark:border-blue-800');
        });

        test('должен возвращать разные конфигурации для разных статусов', () => {
            const holdConfig = getStatusColor('hold');
            const paidConfig = getStatusColor('paid');
            const cancelledConfig = getStatusColor('cancelled');

            expect(holdConfig.bgColor).not.toBe(paidConfig.bgColor);
            expect(paidConfig.bgColor).not.toBe(cancelledConfig.bgColor);
            expect(holdConfig.className).not.toBe(paidConfig.className);
        });
    });
});

