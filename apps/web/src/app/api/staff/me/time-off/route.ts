import { serverStaffRu } from '@/app/_components/i18n/dictionaries/serverStaff.ru';
import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getStaffContextForRequest } from '@/lib/authBiz';
import { validDate } from '@/lib/scheduling/model';
import { withLocalizedMessages } from '@/lib/serverMessages';
import { getServiceClient } from '@/lib/supabaseService';

/**
 * The signed-in master's own active absences overlapping [from, to]. RLS lets only managers read
 * staff_time_off, so the app's schedule (dated rules while the explicit model is off) could not show
 * a day the shift screen already calls a day off. Dates only: the reason stays with the manager.
 */
export const GET = withLocalizedMessages(async function GET(request: Request) {
    return withErrorHandler('StaffMeTimeOff', async () => {
        const params = new URL(request.url).searchParams;
        const from = params.get('from') || '';
        const to = params.get('to') || '';
        if (!validDate(from) || !validDate(to) || from > to) {
            // The shared server message, localized for the request by withErrorHandler.
            return createErrorResponse('validation', serverStaffRu['server.staff.invalidDateFormatYmd'], undefined, 400);
        }
        const context = await getStaffContextForRequest(request, 'StaffMeTimeOff');
        const { data, error } = await getServiceClient().from('staff_time_off')
            .select('date_from,date_to')
            .eq('staff_id', context.staffId)
            .eq('biz_id', context.bizId)
            .is('cancelled_at', null)
            .lte('date_from', to)
            .gte('date_to', from)
            .order('date_from', { ascending: true })
            .limit(100);
        if (error) throw error;
        return createSuccessResponse({ items: data ?? [] });
    });
});
