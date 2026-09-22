import { scheduleHttp } from '@/lib/scheduling/server';

export async function GET(request: Request) {
    return scheduleHttp(request);
}
