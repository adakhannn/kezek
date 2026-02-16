import { withErrorHandler, createSuccessResponse } from '@/lib/apiErrorHandler';
import { swaggerSpec } from '@/lib/swagger';

export async function GET() {
    return withErrorHandler('SwaggerJson', async () => {
        return createSuccessResponse(swaggerSpec);
    });
}

