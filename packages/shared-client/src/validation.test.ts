import {
    isUuid,
    isEmail,
    isE164,
    validateEmail,
    validatePhone,
    validateName,
    validatePositiveNumber,
    validatePercent,
    validatePriceRange,
    validatePercentSum,
} from './validation';

describe('shared-client/validation', () => {
    test('isUuid корректно отличает валидные/невалидные UUID', () => {
        expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(isUuid('not-a-uuid')).toBe(false);
        expect(isUuid('550e8400e29b41d4a716446655440000')).toBe(false);
    });

    test('isEmail и validateEmail проверяют формат и длину', () => {
        expect(isEmail('test@example.com')).toBe(true);
        expect(isEmail('invalid@')).toBe(false);

        expect(validateEmail('').valid).toBe(true);
        expect(validateEmail('bad-email').valid).toBe(false);
        expect(validateEmail('x'.repeat(250) + '@example.com').valid).toBe(false);
    });

    test('isE164 и validatePhone проверяют телефон в формате E.164', () => {
        expect(isE164('+996555123456')).toBe(true);
        expect(isE164('996555123456')).toBe(false);

        expect(validatePhone('', false).valid).toBe(true);
        expect(validatePhone('', true).valid).toBe(false);
        expect(validatePhone('+996555123456', true).valid).toBe(true);
        expect(validatePhone('123', true).valid).toBe(false);
    });

    test('validateName учитывает required и длину', () => {
        expect(validateName('', false).valid).toBe(true);
        expect(validateName('', true).valid).toBe(false);
        expect(validateName('A', true).valid).toBe(false);
        expect(validateName('AB', true).valid).toBe(true);
        expect(validateName('A'.repeat(101), true).valid).toBe(false);
    });

    test('validatePositiveNumber и validatePercent проверяют диапазоны', () => {
        expect(validatePositiveNumber('', { required: false }).valid).toBe(true);
        expect(validatePositiveNumber('', { required: true }).valid).toBe(false);
        expect(validatePositiveNumber('not-a-number').valid).toBe(false);
        expect(validatePositiveNumber(0, { allowZero: false }).valid).toBe(false);
        expect(validatePositiveNumber(10, { min: 5, max: 20 }).valid).toBe(true);

        expect(validatePercent(50).valid).toBe(true);
        expect(validatePercent(-1).valid).toBe(false);
        expect(validatePercent(101).valid).toBe(false);
    });

    test('validatePriceRange и validatePercentSum проверяют согласованность значений', () => {
        expect(validatePriceRange(100, 200).valid).toBe(true);
        expect(validatePriceRange(-1, 200).valid).toBe(false);
        expect(validatePriceRange(300, 200).valid).toBe(false);

        expect(validatePercentSum(60, 40).valid).toBe(true);
        expect(validatePercentSum(50, 40).valid).toBe(false);
    });
});

