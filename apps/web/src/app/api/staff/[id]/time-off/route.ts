import { staffTimeOffHttp } from '@/lib/scheduling/timeOffServer';
import { withLocalizedMessages } from '@/lib/serverMessages';

type Context = { params: Promise<{ id: string }> };

export const GET = withLocalizedMessages(async function GET(request: Request, context: Context) {
    return staffTimeOffHttp(request, (await context.params).id);
});

export const POST = withLocalizedMessages(async function POST(request: Request, context: Context) {
    return staffTimeOffHttp(request, (await context.params).id);
});

export const PATCH = withLocalizedMessages(async function PATCH(request: Request, context: Context) {
    return staffTimeOffHttp(request, (await context.params).id);
});
