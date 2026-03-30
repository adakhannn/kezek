import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
    validateBody,
    validateQuery,
    validateRequest,
    withValidation,
} from '@/lib/validation/apiValidation';

describe('apiValidation', () => {
    test('validateRequest returns parsed body for valid payload', async () => {
        const req = new Request('http://localhost/api/test', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Ada',
                age: 30,
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await validateRequest(
            req,
            z.object({
                name: z.string(),
                age: z.number(),
            }),
        );

        expect(result).toEqual({
            success: true,
            data: {
                name: 'Ada',
                age: 30,
            },
        });
    });

    test('validateBody is an alias for body validation', async () => {
        const req = new Request('http://localhost/api/test', {
            method: 'POST',
            body: JSON.stringify({
                slug: 'branch-1',
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await validateBody(
            req,
            z.object({
                slug: z.string().min(1),
            }),
        );

        expect(result).toEqual({
            success: true,
            data: {
                slug: 'branch-1',
            },
        });
    });

    test('validateRequest returns validation error response for invalid JSON', async () => {
        const req = new Request('http://localhost/api/test', {
            method: 'POST',
            body: '{bad json',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await validateRequest(req, z.object({ name: z.string() }));

        expect(result.success).toBe(false);
        if (result.success) {
            throw new Error('expected validation failure');
        }
        expect(result.response.status).toBe(400);
        await expect(result.response.json()).resolves.toMatchObject({
            ok: false,
            error: 'validation',
            message: 'Invalid JSON in request body',
        });
    });

    test('validateRequest returns zod issues for invalid body', async () => {
        const req = new Request('http://localhost/api/test', {
            method: 'POST',
            body: JSON.stringify({
                name: '',
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await validateRequest(
            req,
            z.object({
                name: z.string().min(2, 'too short'),
            }),
        );

        expect(result.success).toBe(false);
        if (result.success) {
            throw new Error('expected validation failure');
        }
        await expect(result.response.json()).resolves.toMatchObject({
            ok: false,
            error: 'validation',
            message: 'Validation failed',
            details: {
                errors: [{ path: 'name', message: 'too short' }],
            },
        });
    });

    test('validateRequest handles unknown parsing errors', async () => {
        const req = {
            json: jest.fn().mockRejectedValue('unexpected failure'),
        } as unknown as Request;

        const result = await validateRequest(req, z.object({}));

        expect(result.success).toBe(false);
        if (result.success) {
            throw new Error('expected validation failure');
        }
        await expect(result.response.json()).resolves.toMatchObject({
            ok: false,
            error: 'validation',
            message: 'Failed to validate request',
            details: 'unexpected failure',
        });
    });

    test('withValidation returns validation response instead of calling handler', async () => {
        const handler = jest.fn();
        const wrapped = withValidation(
            z.object({
                amount: z.number().positive(),
            }),
            handler,
        );

        const response = await wrapped(
            new Request('http://localhost/api/test', {
                method: 'POST',
                body: JSON.stringify({ amount: -1 }),
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        expect(handler).not.toHaveBeenCalled();
        expect(response.status).toBe(400);
    });

    test('withValidation passes parsed data and request to handler', async () => {
        const handler = jest.fn(async (data, req) =>
            NextResponse.json({
                ok: true,
                data,
                url: req.url,
            }),
        );
        const wrapped = withValidation(
            z.object({
                name: z.string(),
            }),
            handler,
        );

        const req = new Request('http://localhost/api/test', {
            method: 'POST',
            body: JSON.stringify({ name: 'Grace' }),
            headers: { 'Content-Type': 'application/json' },
        });

        const response = await wrapped(req);

        expect(handler).toHaveBeenCalledWith({ name: 'Grace' }, req);
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            data: { name: 'Grace' },
            url: 'http://localhost/api/test',
        });
    });

    test('validateQuery parses repeated params into arrays', () => {
        const url = new URL('http://localhost/api/test?tag=a&tag=b&page=2');

        const result = validateQuery(
            url,
            z.object({
                tag: z.array(z.string()),
                page: z.string(),
            }),
        );

        expect(result).toEqual({
            success: true,
            data: {
                tag: ['a', 'b'],
                page: '2',
            },
        });
    });

    test('validateQuery returns zod errors for invalid query params', async () => {
        const url = new URL('http://localhost/api/test?page=not-a-number');

        const result = validateQuery(
            url,
            z.object({
                page: z.string().regex(/^\d+$/, 'digits only'),
            }),
        );

        expect(result.success).toBe(false);
        if (result.success) {
            throw new Error('expected validation failure');
        }
        await expect(result.response.json()).resolves.toMatchObject({
            ok: false,
            error: 'validation',
            message: 'Invalid query parameters',
            details: {
                errors: [{ path: 'page', message: 'digits only' }],
            },
        });
    });
});
