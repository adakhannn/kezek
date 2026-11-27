// Tiny local stand-in for the web app and PostgREST, used only by load.test.mjs to prove the load
// runner, URL guard and summary formatter work without Docker. It is not a model of Kezek's speed.
//
//   node scripts/load/stub-server.mjs [port]     # listens on 127.0.0.1 only
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const STAFF = 'e2e00000-0000-4000-8000-000000000031';
const BRANCH = 'e2e00000-0000-4000-8000-000000000011';

export function startStubServer(port = 0) {
    const taken = new Set();
    const stats = { requests: 0, bookings: 0, conflicts: 0, xffMissing: 0 };
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const server = http.createServer(async (req, res) => {
        stats.requests += 1;
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');
        const url = new URL(req.url, 'http://127.0.0.1');
        await delay(2 + Math.random() * 8);
        const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
        if (req.method === 'GET' && (url.pathname === '/' || url.pathname.startsWith('/b/'))) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<html><body>${url.pathname}</body></html>`);
            return;
        }
        if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/get_free_slots_service_day_v2') {
            if (!req.headers.apikey) return json(401, { message: 'no apikey' });
            const { p_day: day } = JSON.parse(body);
            const slots = Array.from({ length: 12 }, (_, i) => {
                const start = new Date(`${day}T${String(8 + i).padStart(2, '0')}:00:00+06:00`);
                return { staff_id: STAFF, branch_id: BRANCH, start_at: start.toISOString(), end_at: new Date(start.getTime() + 3_600_000).toISOString() };
            });
            return json(200, slots);
        }
        if (req.method === 'POST' && url.pathname === '/api/quick-book-guest') {
            if (!req.headers['idempotency-key'] || !/^[a-f0-9]{64}$/.test(req.headers['x-booking-client-token'] ?? '')) {
                return json(400, { ok: false, error: 'validation' });
            }
            if (!req.headers['x-forwarded-for']) stats.xffMissing += 1;
            const input = JSON.parse(body);
            const key = `${input.staff_id}|${input.start_at}`;
            if (taken.has(key)) { stats.conflicts += 1; return json(409, { ok: false, error: 'booking_slot_unavailable' }); }
            taken.add(key);
            stats.bookings += 1;
            return json(200, { ok: true, data: { booking_id: randomUUID(), confirmed: true } });
        }
        json(404, { ok: false, error: 'not_found' });
    });
    return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => resolve({ server, stats, url: `http://127.0.0.1:${server.address().port}` }));
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    startStubServer(Number(process.argv[2] ?? 0)).then(({ url }) => process.stdout.write(`stub listening on ${url}\n`));
}
