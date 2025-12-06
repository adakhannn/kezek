export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { createUser, type CreateUserPayload } from './_lib';

export async function POST(req: Request) {
    try {
        const raw = (await req.json().catch(() => ({}))) as CreateUserPayload;
        const result = await createUser(raw);

        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
        }

        return NextResponse.json({ ok: true, id: result.id, method: result.method });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
