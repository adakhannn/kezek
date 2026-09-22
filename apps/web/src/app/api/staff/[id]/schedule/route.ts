import { scheduleHttp } from '@/lib/scheduling/server';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    return scheduleHttp(request, (await context.params).id);
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    return scheduleHttp(request, (await context.params).id);
}
