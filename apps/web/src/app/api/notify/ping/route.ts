export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { to, from: fromBody } = await req.json();
    const apiKey = process.env.RESEND_API_KEY;
    // приоритет: что пришло в теле → иначе из ENV → дефолт
    const from = fromBody || process.env.EMAIL_FROM || 'Kezek <onboarding@resend.dev>';

    if (!apiKey) {
        return NextResponse.json({ ok: false, error: 'no RESEND_API_KEY' }, { status: 400 });
    }

    const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to, subject: 'Kezek test', html: '<b>Ping from Kezek</b>' }),
    });

    const text = await resp.text().catch(() => '');
    return NextResponse.json({ ok: resp.ok, status: resp.status, text });
}