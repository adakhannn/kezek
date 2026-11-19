import { workLocationsHttp } from '@/lib/scheduling/locations';
import { withLocalizedMessages } from '@/lib/serverMessages';
export const GET = withLocalizedMessages(async function GET(request: Request) { return workLocationsHttp(request, true); });
