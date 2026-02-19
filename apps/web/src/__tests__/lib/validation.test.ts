import {
  isUuid,
  isEmail,
  isE164,
  validateLatLon,
  coordsToEWKT,
  validateEmail,
  validatePhone,
  validateName,
  validatePositiveNumber,
  validatePercent,
  validatePriceRange,
  validatePercentSum,
} from '@/lib/validation';

describe('validation utils', () => {
  test('isUuid validates correct and incorrect UUIDs', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
  });

  test('isEmail validates simple email format', () => {
    expect(isEmail('test@example.com')).toBe(true);
    expect(isEmail('invalid-email')).toBe(false);
    expect(isEmail('user@domain')).toBe(false);
  });

  test('isE164 validates E.164 phone numbers', () => {
    expect(isE164('+996555123456')).toBe(true);
    expect(isE164('+123')).toBe(false);
    expect(isE164('996555123456')).toBe(false);
  });

  test('validateLatLon returns ok=false for invalid coordinates and ok=true for valid', () => {
    expect(validateLatLon(42.87, 74.59)).toEqual({ ok: true, lat: 42.87, lon: 74.59 });
    expect(validateLatLon('42.87', '74.59')).toEqual({ ok: true, lat: 42.87, lon: 74.59 });
    expect(validateLatLon(null, 74.59)).toEqual({ ok: false });
    expect(validateLatLon(100, 10)).toEqual({ ok: false }); // lat out of range
    expect(validateLatLon(10, 200)).toEqual({ ok: false }); // lon out of range
  });

  test('coordsToEWKT formats coordinates correctly', () => {
    expect(coordsToEWKT(42.87, 74.59)).toBe('SRID=4326;POINT(74.59 42.87)');
  });

  test('validateEmail allows empty (optional) and validates format and length', () => {
    expect(validateEmail('')).toEqual({ valid: true });
    expect(validateEmail('test@example.com')).toEqual({ valid: true });
    expect(validateEmail('invalid-email').valid).toBe(false);

    const longEmail = `${'a'.repeat(250)}@example.com`;
    const longResult = validateEmail(longEmail);
    expect(longResult.valid).toBe(false);
    expect(longResult.error).toContain('слишком длинный');
  });

  test('validatePhone respects required flag and E.164 format', () => {
    // optional
    expect(validatePhone('', false)).toEqual({ valid: true });
    // required but empty
    expect(validatePhone('', true)).toEqual({ valid: false, error: 'Телефон обязателен' });
    // valid E.164
    expect(validatePhone('+996555123456', true)).toEqual({ valid: true });
    // invalid
    const invalid = validatePhone('12345', true);
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toContain('Неверный формат телефона');
  });

  test('validateName enforces min/max length and required flag', () => {
    expect(validateName('')).toEqual({ valid: false, error: 'Имя обязательно' });
    expect(validateName('', false)).toEqual({ valid: true });
    expect(validateName('A').valid).toBe(false);
    expect(validateName('Al').valid).toBe(true);

    const longName = 'a'.repeat(101);
    const longRes = validateName(longName);
    expect(longRes.valid).toBe(false);
    expect(longRes.error).toContain('слишком длинное');
  });

  test('validatePositiveNumber handles required, ranges and zero rules', () => {
    // not required & empty
    expect(validatePositiveNumber('', { required: false })).toEqual({ valid: true });
    // required & empty
    expect(validatePositiveNumber('', { required: true }).valid).toBe(false);
    // non numeric
    expect(validatePositiveNumber('abc').valid).toBe(false);
    // zero not allowed
    expect(validatePositiveNumber(0, { allowZero: false }).valid).toBe(false);
    // min and max
    expect(validatePositiveNumber(5, { min: 1, max: 10 })).toEqual({ valid: true });
    expect(validatePositiveNumber(0, { min: 1 }).valid).toBe(false);
    expect(validatePositiveNumber(11, { max: 10 }).valid).toBe(false);
  });

  test('validatePercent is a thin wrapper around validatePositiveNumber 0..100', () => {
    expect(validatePercent(0).valid).toBe(true);
    expect(validatePercent(100).valid).toBe(true);
    expect(validatePercent(-1).valid).toBe(false);
    expect(validatePercent(101).valid).toBe(false);
  });

  test('validatePriceRange checks non-negative and from <= to', () => {
    expect(validatePriceRange(0, 0)).toEqual({ valid: true });
    expect(validatePriceRange(100, 200)).toEqual({ valid: true });
    expect(validatePriceRange(-1, 10).valid).toBe(false);
    expect(validatePriceRange(200, 100).valid).toBe(false);

    // NaN values => treated as "not filled" and valid
    expect(validatePriceRange('not-a-number', 10)).toEqual({ valid: true });
  });

  test('validatePercentSum requires both numbers and sum close to 100', () => {
    expect(validatePercentSum(60, 40)).toEqual({ valid: true });
    expect(validatePercentSum('60', '40')).toEqual({ valid: true });
    expect(validatePercentSum(50, 40).valid).toBe(false);
    expect(validatePercentSum('a', 40).valid).toBe(false);
  });
});


