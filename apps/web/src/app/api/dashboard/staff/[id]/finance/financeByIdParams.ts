import { withErrorHandler } from '@/lib/apiErrorHandler';
import { validateQuery } from '@/lib/validation/apiValidation';
import { staffFinanceByIdQuerySchema } from '@/lib/validation/schemas';

export type FinanceByIdQuery = {
    targetDate: Date;
};

export function resolveFinanceByIdQuery(req: Request): FinanceByIdQuery | Response {
    const url = new URL(req.url);
    const queryValidation = validateQuery(url, staffFinanceByIdQuerySchema);
    if (!queryValidation.success) {
        return queryValidation.response;
    }

    const { date: dateParam } = queryValidation.data;
    let targetDate: Date;
    if (dateParam) {
        const [year, month, day] = dateParam.split('-').map(Number);
        targetDate = new Date(year, month - 1, day);
    } else {
        targetDate = new Date();
    }

    return { targetDate };
}
