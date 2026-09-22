import { workLocationsHttp } from '@/lib/scheduling/locations';
export async function GET(request: Request) { return workLocationsHttp(request, true); }
