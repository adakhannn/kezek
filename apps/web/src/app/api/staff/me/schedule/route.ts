import { scheduleHttp } from '@/lib/scheduling/server';
import { withLocalizedMessages } from '@/lib/serverMessages';

export const GET = withLocalizedMessages(async function GET(request: Request) {
    return scheduleHttp(request);
});
