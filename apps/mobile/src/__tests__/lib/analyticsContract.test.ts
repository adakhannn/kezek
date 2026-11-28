/**
 * The app sends only event types the web endpoint accepts: any other one answers 400 and spends
 * the telemetry rate limit (the mobile_google_login_* events did, Sentry triage 2026-11-28).
 */
import fs from 'fs';
import path from 'path';

import { apiRequest } from '../../lib/api';
import { SUPPORTED_MOBILE_ANALYTICS_EVENTS, trackMobileEvent } from '../../lib/analytics';

jest.mock('../../lib/api', () => ({ apiRequest: jest.fn(async () => ({ ok: true })) }));

const MOBILE_SRC = path.resolve(__dirname, '../..');
const SERVER_SCHEMA = path.resolve(__dirname, '../../../../web/src/lib/analyticsTrackHttpService.ts');

function serverEventTypes(): string[] {
    const source = fs.readFileSync(SERVER_SCHEMA, 'utf8');
    const match = source.match(/event_type:\s*z\.enum\(\[([^\]]*)\]\)/);
    if (!match) throw new Error('event_type enum not found in analyticsTrackHttpService.ts');
    return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
        return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
}

describe('mobile analytics contract', () => {
    test('the supported list is exactly the server allow-list', () => {
        expect([...SUPPORTED_MOBILE_ANALYTICS_EVENTS].sort()).toEqual(serverEventTypes().sort());
    });

    test('every event type the app sends is accepted by the server', () => {
        const allowed = new Set(serverEventTypes());
        const used = sourceFiles(MOBILE_SRC)
            .filter((file) => fs.readFileSync(file, 'utf8').includes('trackMobileEvent('))
            .flatMap((file) =>
                [...fs.readFileSync(file, 'utf8').matchAll(/eventType:\s*'([^']+)'/g)].map((m) => ({
                    file: path.relative(MOBILE_SRC, file),
                    eventType: m[1],
                })),
            );

        expect(used.length).toBeGreaterThan(0);
        expect(used.filter(({ eventType }) => !allowed.has(eventType))).toEqual([]);
    });

    test('an unsupported type is not sent at all', async () => {
        await trackMobileEvent({ eventType: 'mobile_google_login_started' as never });
        expect(apiRequest).not.toHaveBeenCalled();

        await trackMobileEvent({ eventType: 'home_view' });
        expect(apiRequest).toHaveBeenCalledTimes(1);
    });
});
