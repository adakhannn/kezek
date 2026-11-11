import { NextResponse } from 'next/server';

import { swaggerSpec } from '@/lib/swagger';

/** OpenAPI consumers require the document at the JSON root, without ok/data. */
export async function GET() {
    return NextResponse.json(swaggerSpec);
}
