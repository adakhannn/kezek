import { NextResponse } from 'next/server';

import { androidAssetLinks } from '@/lib/androidAssetLinks';

export const dynamic = 'force-dynamic';

/** Android App Links verification file; 404 until ANDROID_APP_LINK_SHA256_FINGERPRINTS is set. */
export function GET() {
    const statements = androidAssetLinks(process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS);
    if (!statements) return new NextResponse(null, { status: 404 });
    return NextResponse.json(statements, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
