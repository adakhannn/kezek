import { NextResponse } from 'next/server';

/**
 * Legacy phone/userId authentication never proved ownership of the selected user.
 * Both supported clients use the challenge-bound start/verify/exchange protocol.
 * Keep an explicit tombstone for old clients; never restore a credential fallback.
 */
export function retiredWhatsAppAuthResponse(): NextResponse {
    return NextResponse.json({
        ok: false,
        error: 'auth_protocol_retired',
        message: 'Этот способ входа больше не поддерживается. Откройте актуальную страницу входа.',
    }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
