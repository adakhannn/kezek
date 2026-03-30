import { logError } from '@/lib/log';
import { TZ, todayStringInTz, formatDateInTz } from '@/lib/time';
import { validateQuery } from '@/lib/validation/apiValidation';
import { staffFinanceByIdQuerySchema } from '@/lib/validation/schemas';

type DeprecatedStaffFinanceContext = {
    req: Request;
    supabase: any;
    admin: any;
    bizId: string;
    staffId: string;
    staff: {
        percent_master: number | null;
        percent_salon: number | null;
        hourly_rate: number | null;
    };
};

type DeprecatedStaffFinanceFailure = {
    ok: false;
    status: 400 | 500;
    error: 'validation' | 'internal';
    message: string;
};

type DeprecatedStaffFinanceSuccess = {
    ok: true;
    data: Record<string, unknown>;
};

export type DeprecatedStaffFinanceResult =
    | DeprecatedStaffFinanceFailure
    | DeprecatedStaffFinanceSuccess;

export async function runDeprecatedStaffFinance({
    req,
    supabase,
    admin,
    bizId,
    staffId,
    staff,
}: DeprecatedStaffFinanceContext): Promise<DeprecatedStaffFinanceResult> {
    const url = new URL(req.url);
    const queryValidation = validateQuery(url, staffFinanceByIdQuerySchema);
    if (!queryValidation.success) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Invalid query parameters',
        };
    }

    const targetDate = parseTargetDate(queryValidation.data.date);
    const ymd = formatDateInTz(targetDate, TZ);
    const today = todayStringInTz(TZ);

    const staffPercentMaster = Number(staff.percent_master ?? 60);
    const staffPercentSalon = Number(staff.percent_salon ?? 40);
    const hourlyRate = staff.hourly_rate ? Number(staff.hourly_rate) : null;

    const isDayOff = await resolveIsDayOff({
        supabase,
        bizId,
        staffId,
        ymd,
        today,
    });

    const { data: shift, error: shiftError } = await admin
        .from('staff_shifts')
        .select('*')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('shift_date', ymd)
        .maybeSingle();

    if (shiftError) {
        logError('DeprecatedStaffFinance', 'Error loading shift', shiftError);
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: shiftError.message,
        };
    }

    const items = shift?.id ? await loadShiftItems({ admin, shiftId: shift.id }) : [];
    const bookings = await loadBookings({ supabase, staffId, ymd });
    const services = await loadAvailableServices({ supabase, staffId });
    const currentWork = calculateCurrentWork({ shift, hourlyRate, now: new Date() });
    const statsWindowStart = buildStatsWindowStart(targetDate);
    const recentShiftsResult = await loadRecentClosedShifts({
        admin,
        bizId,
        staffId,
        statsWindowStart,
    });
    const allShiftsResult = await loadAllShifts({
        admin,
        bizId,
        staffId,
    });

    if (!recentShiftsResult.ok) {
        return recentShiftsResult;
    }

    if (!allShiftsResult.ok) {
        return allShiftsResult;
    }

    return {
        ok: true,
        data: {
            today: shift
                ? {
                      exists: true,
                      status: shift.status,
                      shift: {
                          id: shift.id,
                          shift_date: shift.shift_date,
                          opened_at: shift.opened_at ?? null,
                          closed_at: shift.closed_at ?? null,
                          expected_start: shift.expected_start ?? null,
                          late_minutes: Number(shift.late_minutes ?? 0),
                          status: shift.status as 'open' | 'closed',
                          total_amount: Number(shift.total_amount ?? 0),
                          consumables_amount: Number(shift.consumables_amount ?? 0),
                          master_share: Number(shift.master_share ?? 0),
                          salon_share: Number(shift.salon_share ?? 0),
                          percent_master: staffPercentMaster,
                          percent_salon: staffPercentSalon,
                          hours_worked:
                              shift.hours_worked == null ? null : Number(shift.hours_worked),
                          hourly_rate: hourlyRate,
                          guaranteed_amount:
                              shift.guaranteed_amount == null
                                  ? undefined
                                  : Number(shift.guaranteed_amount),
                          topup_amount:
                              shift.topup_amount == null ? undefined : Number(shift.topup_amount),
                      },
                      items,
                  }
                : {
                      exists: false,
                      status: 'none',
                      shift: null,
                      items: [],
                  },
            bookings,
            services,
            allShifts: allShiftsResult.data.map((entry: any) => ({
                shift_date: typeof entry.shift_date === 'string' ? entry.shift_date : '',
                status: typeof entry.status === 'string' ? entry.status : 'closed',
                total_amount: Number(entry.total_amount ?? 0),
                master_share: Number(entry.master_share ?? 0),
                salon_share: Number(entry.salon_share ?? 0),
                late_minutes: Number(entry.late_minutes ?? 0),
            })),
            staffPercentMaster,
            staffPercentSalon,
            hourlyRate,
            currentHoursWorked: currentWork.currentHoursWorked,
            currentGuaranteedAmount: currentWork.currentGuaranteedAmount,
            isDayOff,
            stats: buildStats(recentShiftsResult.data),
        },
    };
}

function parseTargetDate(dateParam?: string) {
    if (!dateParam) {
        return new Date();
    }

    const [year, month, day] = dateParam.split('-').map(Number);
    return new Date(year, month - 1, day);
}

async function resolveIsDayOff({
    supabase,
    bizId,
    staffId,
    ymd,
    today,
}: {
    supabase: any;
    bizId: string;
    staffId: string;
    ymd: string;
    today: string;
}) {
    if (ymd !== today) {
        return false;
    }

    const { data: timeOffs } = await supabase
        .from('staff_time_off')
        .select('id')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .lte('date_from', ymd)
        .gte('date_to', ymd);

    if (timeOffs && timeOffs.length > 0) {
        return true;
    }

    const { data: dateRule } = await supabase
        .from('staff_schedule_rules')
        .select('intervals')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('kind', 'date')
        .eq('date_on', ymd)
        .eq('is_active', true)
        .maybeSingle();

    return !!(dateRule && Array.isArray(dateRule.intervals) && dateRule.intervals.length === 0);
}

async function loadShiftItems({ admin, shiftId }: { admin: any; shiftId: string }) {
    const { data, error } = await admin
        .from('staff_shift_items')
        .select(
            'id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at',
        )
        .eq('shift_id', shiftId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

    if (error) {
        logError('DeprecatedStaffFinance', 'Error loading shift items', error);
        return [];
    }

    return Array.isArray(data) ? data : [];
}

async function loadBookings({
    supabase,
    staffId,
    ymd,
}: {
    supabase: any;
    staffId: string;
    ymd: string;
}) {
    const { data, error } = await supabase
        .from('bookings')
        .select(
            'id, client_name, client_phone, start_at, services:services!bookings_service_id_fkey (name_ru, name_ky, name_en)',
        )
        .eq('staff_id', staffId)
        .gte('start_at', `${ymd}T00:00:00`)
        .lte('start_at', `${ymd}T23:59:59`)
        .neq('status', 'cancelled')
        .order('start_at', { ascending: true });

    if (error) {
        logError('DeprecatedStaffFinance', 'Error loading bookings', error);
    }

    return data ?? [];
}

async function loadAvailableServices({ supabase, staffId }: { supabase: any; staffId: string }) {
    const { data, error } = await supabase
        .from('service_staff')
        .select('services:services!inner (name_ru, name_ky, name_en)')
        .eq('staff_id', staffId)
        .eq('is_active', true)
        .eq('services.active', true);

    if (error) {
        logError('DeprecatedStaffFinance', 'Error loading staff services', error);
    }

    return (Array.isArray(data) ? data : [])
        .map((entry: any) => {
            const service = Array.isArray(entry?.services) ? entry.services[0] : entry?.services;
            if (!service || typeof service.name_ru !== 'string' || !service.name_ru) {
                return null;
            }

            return {
                name_ru: service.name_ru,
                name_ky: typeof service.name_ky === 'string' ? service.name_ky : null,
                name_en: typeof service.name_en === 'string' ? service.name_en : null,
            };
        })
        .filter(
            (
                service,
            ): service is { name_ru: string; name_ky: string | null; name_en: string | null } =>
                service !== null,
        );
}

function calculateCurrentWork({
    shift,
    hourlyRate,
    now,
}: {
    shift: any;
    hourlyRate: number | null;
    now: Date;
}) {
    if (!shift || shift.status !== 'open' || !shift.opened_at || !hourlyRate) {
        return {
            currentHoursWorked: null,
            currentGuaranteedAmount: null,
        };
    }

    const diffMs = now.getTime() - new Date(shift.opened_at).getTime();
    const currentHoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
    return {
        currentHoursWorked,
        currentGuaranteedAmount: currentHoursWorked * hourlyRate,
    };
}

function buildStatsWindowStart(targetDate: Date) {
    const thirtyDaysAgo = new Date(targetDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return formatDateInTz(thirtyDaysAgo, TZ);
}

async function loadRecentClosedShifts({
    admin,
    bizId,
    staffId,
    statsWindowStart,
}: {
    admin: any;
    bizId: string;
    staffId: string;
    statsWindowStart: string;
}): Promise<
    | { ok: true; data: any[] }
    | { ok: false; status: 500; error: 'internal'; message: string }
> {
    const { data, error } = await admin
        .from('staff_shifts')
        .select('total_amount, master_share, salon_share, late_minutes')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('status', 'closed')
        .gte('shift_date', statsWindowStart)
        .order('shift_date', { ascending: false });

    if (error) {
        logError('DeprecatedStaffFinance', 'Error loading stats', error);
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: error.message,
        };
    }

    return { ok: true, data: Array.isArray(data) ? data : [] };
}

async function loadAllShifts({
    admin,
    bizId,
    staffId,
}: {
    admin: any;
    bizId: string;
    staffId: string;
}): Promise<
    | { ok: true; data: any[] }
    | { ok: false; status: 500; error: 'internal'; message: string }
> {
    const { data, error } = await admin
        .from('staff_shifts')
        .select('shift_date, status, total_amount, master_share, salon_share, late_minutes')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .order('shift_date', { ascending: false });

    if (error) {
        logError('DeprecatedStaffFinance', 'Error loading all shifts', error);
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: error.message,
        };
    }

    return { ok: true, data: Array.isArray(data) ? data : [] };
}

function buildStats(entries: any[]) {
    return entries.reduce(
        (acc, entry) => ({
            totalAmount: acc.totalAmount + Number(entry.total_amount ?? 0),
            totalMaster: acc.totalMaster + Number(entry.master_share ?? 0),
            totalSalon: acc.totalSalon + Number(entry.salon_share ?? 0),
            totalLateMinutes: acc.totalLateMinutes + Number(entry.late_minutes ?? 0),
            shiftsCount: acc.shiftsCount + 1,
        }),
        {
            totalAmount: 0,
            totalMaster: 0,
            totalSalon: 0,
            totalLateMinutes: 0,
            shiftsCount: 0,
        },
    );
}
