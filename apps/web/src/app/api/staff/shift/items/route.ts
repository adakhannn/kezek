// apps/web/src/app/api/staff/shift/items/route.ts
import {
    createShiftItemsUseCaseHttpResponse,
    createShiftItemsValidationHttpResponse,
} from './shiftItemsHttp';
import { saveShiftItemsApplication } from './saveShiftItemsApplication';

import { withErrorHandler, createErrorResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { validateRequest } from '@/lib/validation/apiValidation';
import { saveShiftItemsSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    const httpContext = {
        endpoint: '/api/staff/shift/items',
        req,
        startTime: Date.now(),
    };

    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        async () => {
            try {
                return await withErrorHandler('StaffShiftItems', async () => {
                    const validationResult = await validateRequest(req, saveShiftItemsSchema);
                    if (!validationResult.success) {
                        const errorResponse = await validationResult.response.json();
                        const errorMessage = errorResponse.errors
                            ? `Ошибка валидации: ${errorResponse.errors.map((e: { path: string; message: string }) => `${e.path}: ${e.message}`).join(', ')}`
                            : errorResponse.message || 'Ошибка валидации данных';

                        return createShiftItemsValidationHttpResponse({
                            context: httpContext,
                            errorMessage,
                        });
                    }

                    const { items, staffId: targetStaffId, shiftDate: targetShiftDate } = validationResult.data;
                    const saveResult = await saveShiftItemsApplication({
                        items,
                        targetStaffId,
                        targetShiftDate,
                    });

                    return createShiftItemsUseCaseHttpResponse({
                        context: httpContext,
                        result: saveResult,
                    });
                });
            } catch (error) {
                logError('StaffShiftItems', 'Error saving shift items', error);
                return createErrorResponse('internal', 'Ошибка при сохранении данных', undefined, 500);
            }
        }
    );
}
