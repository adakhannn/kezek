import { staffTimeOffHttp } from '@/lib/scheduling/timeOffServer';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
    return staffTimeOffHttp(request, (await context.params).id);
}

export async function POST(request: Request, context: Context) {
    return staffTimeOffHttp(request, (await context.params).id);
}

export async function PATCH(request: Request, context: Context) {
    return staffTimeOffHttp(request, (await context.params).id);
}
