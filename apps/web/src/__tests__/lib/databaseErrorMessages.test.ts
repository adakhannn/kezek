import {
    DATABASE_FAILURE_MESSAGES,
    databaseErrorLogData,
    databaseErrorMessage,
    databaseFailure,
    handleApiError,
    isDatabaseError,
    publicErrorMessage,
    reportDatabaseError,
    withErrorHandler,
} from '@/lib/apiErrorHandler';
import { mapApplicationPolicyError } from '@/lib/applicationPolicy';
import { listMobileBusinesses } from '@/lib/mobileBusinessesService';
import { localizeApiResponse } from '@/lib/serverMessages';
import { runStaffRestore } from '@/lib/staffRestoreService';

jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));

const { logError } = jest.requireMock('@/lib/log');

// ENG-47: API answers carried the raw text of Postgres / PostgREST / Supabase errors.
const SECRET = 'relation "secret_internal_table" violates policy';
const postgrestError = (code = 'XX000') => ({ message: SECRET, code, details: 'Key (owner_id)=(42) secret', hint: 'secret hint' });

describe('database error helpers', () => {
    beforeEach(() => jest.clearAllMocks());

    test('isDatabaseError recognises PostgREST, Auth and Storage errors, not ordinary errors', () => {
        expect(isDatabaseError(postgrestError())).toBe(true);
        expect(isDatabaseError(Object.assign(new Error(SECRET), { code: '42P01', details: null, hint: null }))).toBe(true);
        expect(isDatabaseError({ message: 'Phone exists', __isAuthError: true })).toBe(true);
        expect(isDatabaseError({ message: 'Bucket missing', __isStorageError: true })).toBe(true);
        expect(isDatabaseError(new Error('Неверная дата'))).toBe(false);
        expect(isDatabaseError(null)).toBe(false);
    });

    test('databaseErrorMessage maps well-known codes without a fallback, else uses the fallback', () => {
        expect(databaseErrorMessage(postgrestError('23505'))).toBe('Конфликт данных');
        expect(databaseErrorMessage(postgrestError('42501'))).toBe('Доступ запрещен');
        expect(databaseErrorMessage(postgrestError('XX000'))).toBe(DATABASE_FAILURE_MESSAGES.internal);
        expect(databaseErrorMessage(postgrestError('23505'), DATABASE_FAILURE_MESSAGES.save)).toBe(DATABASE_FAILURE_MESSAGES.save);
        expect(databaseErrorMessage(null)).toBe(DATABASE_FAILURE_MESSAGES.internal);
    });

    test('reportDatabaseError keeps the raw error in the server log and returns only the safe text', () => {
        const message = reportDatabaseError('Unit', postgrestError(), DATABASE_FAILURE_MESSAGES.load, { bizId: 'biz-1' });

        expect(message).toBe(DATABASE_FAILURE_MESSAGES.load);
        expect(message).not.toContain('secret');
        expect(logError).toHaveBeenCalledWith('Unit', 'Database error', {
            bizId: 'biz-1',
            code: 'XX000',
            message: SECRET,
            details: 'Key (owner_id)=(42) secret',
            hint: 'secret hint',
        });
        expect(databaseErrorLogData('plain')).toEqual({ error: 'plain' });
    });

    test('reportDatabaseError never fails because of the logger', () => {
        logError.mockImplementationOnce(() => {
            throw new Error('logger down');
        });
        expect(reportDatabaseError('Unit', postgrestError())).toBe(DATABASE_FAILURE_MESSAGES.internal);
    });

    test('databaseFailure throws a safe message and keeps the raw error as its cause', () => {
        const raw = postgrestError();
        const error = databaseFailure(raw, 'Не удалось отменить удаление');

        expect(error.message).toBe('Не удалось отменить удаление');
        expect(error.cause).toBe(raw);
        expect(databaseFailure(raw).message).toBe(DATABASE_FAILURE_MESSAGES.internal);
    });

    test('publicErrorMessage passes text written for people and machine codes, nothing else', () => {
        expect(publicErrorMessage(new Error('Неполный финансовый снимок. Повторите запрос.'), 'fallback')).toBe('Неполный финансовый снимок. Повторите запрос.');
        expect(publicErrorMessage(new Error('UNAUTHORIZED'), 'fallback')).toBe('UNAUTHORIZED');
        expect(publicErrorMessage('NO_BIZ_ACCESS', 'fallback')).toBe('NO_BIZ_ACCESS');
        expect(publicErrorMessage(new Error(SECRET), 'fallback')).toBe('fallback');
        expect(publicErrorMessage(new Error('fetch failed'), 'fallback')).toBe('fallback');
        // A database error object never passes, whatever its text.
        expect(publicErrorMessage(Object.assign(new Error('Ошибка в базе'), { code: 'P0001', details: null }), 'fallback')).toBe('fallback');
        expect(publicErrorMessage(undefined, 'fallback')).toBe('fallback');
    });

    test('the generic messages are server dictionary messages, so they are localized', async () => {
        const { NextResponse } = jest.requireActual('next/server');
        const response = await localizeApiResponse(
            NextResponse.json({ ok: false, error: 'internal', message: DATABASE_FAILURE_MESSAGES.save }, { status: 500 }),
            'en',
        );
        expect((await response.json()).message).toBe('Could not save the changes. Please try again.');
    });
});

describe('handleApiError and withErrorHandler do not leak database text', () => {
    beforeEach(() => jest.clearAllMocks());

    test('a thrown PostgrestError (an Error with code and details) keeps its status class, not its text', async () => {
        const thrown = Object.assign(new Error('invalid input syntax for type uuid: "secret_value"'), { code: 'XX123', details: 'secret', hint: null });
        const response = handleApiError(thrown, 'Unit');

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body).toEqual({ ok: false, error: 'validation', message: 'Ошибка валидации' });
    });

    test('an unexpected exception answers the generic 500 message, an intentional Russian one keeps its text', async () => {
        const generic = await withErrorHandler('Unit', async () => {
            throw new Error(`could not connect: ${SECRET}`);
        });
        expect(generic.status).toBe(500);
        expect(JSON.stringify(await generic.json())).not.toContain('secret');

        const intentional = handleApiError(new Error('Смена уже закрыта'), 'Unit');
        expect(await intentional.json()).toMatchObject({ error: 'internal', message: 'Смена уже закрыта' });
    });
});

describe('services answer safe messages for database failures', () => {
    beforeEach(() => jest.clearAllMocks());

    test('mobile business list: no raw text in message or details', async () => {
        const range = jest.fn().mockResolvedValue({ data: null, error: postgrestError() });
        const order = jest.fn().mockReturnValue({ range });
        const eq = jest.fn().mockReturnValue({ order, or: jest.fn(), contains: jest.fn() });
        const from = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) });

        const result = await listMobileBusinesses({ supabase: { from } as never });

        expect(result).toMatchObject({ ok: false, error: 'internal', status: 500 });
        expect(JSON.stringify(result)).not.toContain('secret');
        expect(logError).toHaveBeenCalledWith('MobileBusinesses', 'Database error', expect.objectContaining({ message: SECRET }));
    });

    test('staff restore: status and error code stay, the text is the generic save message', async () => {
        const eqBiz = jest.fn().mockResolvedValue({ error: postgrestError() });
        const update = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: eqBiz }) });

        const result = await runStaffRestore({
            admin: { from: jest.fn().mockReturnValue({ update }) } as never,
            roleAdmin: { from: jest.fn() } as never,
            bizId: 'biz-1',
            staffId: 'staff-1',
            checkResourceBelongsToBiz: jest.fn().mockResolvedValue({
                data: { id: 'staff-1', biz_id: 'biz-1', user_id: null, is_active: false },
                error: null,
            }),
        });

        expect(result).toEqual({ ok: false, error: 'validation', message: DATABASE_FAILURE_MESSAGES.save, status: 400 });
    });

    test('a known database marker is still mapped to its specific message', () => {
        expect(mapApplicationPolicyError({ message: 'APPLICATION_POLICY:active_limit' } as never)).not.toBeNull();
    });
});
