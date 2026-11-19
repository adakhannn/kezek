import { scheduleHttp } from '@/lib/scheduling/server';
import { withLocalizedMessages } from '@/lib/serverMessages';

export const GET = withLocalizedMessages(async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    return scheduleHttp(request, (await context.params).id);
});
export const POST = withLocalizedMessages(async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    return scheduleHttp(request, (await context.params).id);
});
