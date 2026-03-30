import { NextResponse } from 'next/server';

import { createSuccessResponse } from '@/lib/apiErrorHandler';
import { getIntegrationsStatus } from '@/lib/integrationsStatusService';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runIntegrationsStatusHttp(req: Request): Promise<NextResponse> {
    return withManagerContext(req, 'IntegrationsStatus', async () =>
        createSuccessResponse(await getIntegrationsStatus()),
    );
}
