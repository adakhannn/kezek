export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
    withErrorHandler,
} from '@/lib/apiErrorHandler';
import { runBookingCancelHttp } from '@/lib/bookingCancelHttpService';

export async function POST(req: Request, context: unknown) {
    return withErrorHandler('BookingsCancel', async () => runBookingCancelHttp(req, context));
}
