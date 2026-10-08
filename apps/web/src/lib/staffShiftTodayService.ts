import type { SupabaseClient } from '@supabase/supabase-js';

import { logError } from '@/lib/log';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { readScheduledDay } from '@/lib/scheduling/read';
import { TZ, formatDateInTz } from '@/lib/time';

type StaffShiftTodayContext = {
    supabase: SupabaseClient;
    staffId: string;
    bizId: string;
};

type StaffShiftTodayFailure = {
    ok: false;
    status: 500;
    error: 'internal';
    message: string;
};

type StaffShiftTodaySuccess = {
    ok: true;
    data: Record<string, unknown>;
};

type StaffShiftTodayResult = StaffShiftTodayFailure | StaffShiftTodaySuccess;

export async function runStaffShiftToday({
    supabase,
    staffId,
    bizId,
    now = new Date(),
}: StaffShiftTodayContext & { now?: Date }): Promise<StaffShiftTodayResult> {
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('percent_master, percent_salon, hourly_rate')
        .eq('id', staffId)
        .maybeSingle();

    if (staffError) {
        logError('StaffShiftToday', 'Error loading staff for percent', staffError);
    }

    const staffPercentMaster = Number(staffData?.percent_master ?? 60);
    const staffPercentSalon = Number(staffData?.percent_salon ?? 40);
    const hourlyRate = staffData?.hourly_rate ? Number(staffData.hourly_rate) : null;

    const scheduled = explicitSchedulingEnabled() ? await readScheduledDay(staffId, bizId, now) : null;
    const ymd = scheduled?.ymd ?? formatDateInTz(now, TZ);
    const dow = new Date(`${ymd}T12:00:00`).getDay();

    const isDayOff = scheduled ? !scheduled.day.intervals.length : await resolveIsDayOff({ supabase, staffId, bizId, ymd, dow });

    const { data: shift, error: shiftError } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('staff_id', staffId)
        .eq('shift_date', ymd)
        .maybeSingle();

    if (shiftError) {
        logError('StaffShiftToday', 'Error loading today shift', shiftError);
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: shiftError.message,
        };
    }

    const items = shift ? await loadShiftItems({ supabase, shiftId: shift.id }) : [];
    const todayBookings = await loadTodayBookings({ supabase, staffId, ymd });
    const availableServices = await loadAvailableServices({ supabase, staffId });
    const currentWork = calculateCurrentWork({ shift, hourlyRate, now });

    const { data: allShifts, error: statsError } = await supabase
        .from('staff_shifts')
        .select('id, shift_date, status, total_amount, master_share, salon_share, late_minutes, guaranteed_amount, topup_amount')
        .eq('staff_id', staffId)
        .order('shift_date', { ascending: false });

    if (statsError) {
        logError('StaffShiftToday', 'Error loading shifts stats', statsError);
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: statsError.message,
        };
    }

    const closedShifts = (allShifts ?? []).filter((entry: { status: string }) => entry.status === 'closed');
    const stats = {
        totalAmount: closedShifts.reduce(
            (sum: number, entry: { total_amount?: number | null }) => sum + Number(entry.total_amount || 0),
            0,
        ),
        totalMaster: closedShifts.reduce(
            (
                sum: number,
                entry: { guaranteed_amount?: number | null; master_share?: number | null },
            ) => {
                const guaranteed = Number(entry.guaranteed_amount || 0);
                const masterShare = Number(entry.master_share || 0);
                return sum + (guaranteed > masterShare ? guaranteed : masterShare);
            },
            0,
        ),
        totalSalon: closedShifts.reduce(
            (
                sum: number,
                entry: { salon_share?: number | null; topup_amount?: number | null },
            ) => sum + Number(entry.salon_share || 0) - Number(entry.topup_amount || 0),
            0,
        ),
        totalLateMinutes: closedShifts.reduce(
            (sum: number, entry: { late_minutes?: number | null }) => sum + Number(entry.late_minutes || 0),
            0,
        ),
        shiftsCount: closedShifts.length,
    };

    return {
        ok: true,
        data: {
            allShifts: (allShifts ?? []).map(
                (entry: {
                    shift_date?: string | null;
                    status?: string | null;
                    total_amount?: number | null;
                    master_share?: number | null;
                    salon_share?: number | null;
                    late_minutes?: number | null;
                    guaranteed_amount?: number | null;
                    topup_amount?: number | null;
                }) => ({
                    shift_date: String(entry.shift_date || '').split('T')[0].split(' ')[0],
                    status: entry.status,
                    total_amount: Number(entry.total_amount ?? 0),
                    master_share: Number(entry.master_share ?? 0),
                    salon_share: Number(entry.salon_share ?? 0),
                    late_minutes: Number(entry.late_minutes ?? 0),
                    guaranteed_amount: Number(entry.guaranteed_amount ?? 0),
                    topup_amount: Number(entry.topup_amount ?? 0),
                }),
            ),
            today: shift
                ? {
                      exists: true,
                      status: shift.status,
                      shift,
                      items,
                  }
                : {
                      exists: false,
                      status: 'none',
                      shift: null,
                      items: [],
                  },
            staffPercentMaster,
            staffPercentSalon,
            hourlyRate,
            currentHoursWorked: currentWork.currentHoursWorked,
            currentGuaranteedAmount: currentWork.currentGuaranteedAmount,
            bookings: todayBookings,
            services: availableServices,
            isDayOff,
            stats,
        },
    };
}

async function resolveIsDayOff({
    supabase,
    staffId,
    bizId,
    ymd,
    dow,
}: {
    supabase: SupabaseClient;
    staffId: string;
    bizId: string;
    ymd: string;
    dow: number;
}) {
    const { data: timeOffs } = await supabase
        .from('staff_time_off')
        .select('id')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .is('cancelled_at', null)
        .lte('date_from', ymd)
        .gte('date_to', ymd);

    if (timeOffs && timeOffs.length > 0) {
        return true;
    }

    const { data: dateRule } = await supabase
        .from('staff_schedule_rules')
        .select('intervals, is_active')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('kind', 'date')
        .eq('date_on', ymd)
        .eq('is_active', true)
        .maybeSingle();

    if (dateRule && dateRule.is_active) {
        const intervals = (dateRule.intervals ?? []) as { start: string; end: string }[];
        return !Array.isArray(intervals) || intervals.length === 0;
    }

    const { data: workingHoursRow } = await supabase
        .from('working_hours')
        .select('intervals')
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .eq('day_of_week', dow)
        .maybeSingle();

    const intervals = (workingHoursRow?.intervals ?? []) as { start: string; end: string }[];
    return !Array.isArray(intervals) || intervals.length === 0;
}

async function loadShiftItems({ supabase, shiftId }: { supabase: SupabaseClient; shiftId: string }) {
    const { data, error } = await supabase
        .from('staff_shift_items')
        .select('id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at')
        .eq('shift_id', shiftId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

    if (error) {
        logError('StaffShiftToday', 'Error loading shift items', error);
        return [];
    }

    return data ?? [];
}

async function loadTodayBookings({
    supabase,
    staffId,
    ymd,
}: {
    supabase: SupabaseClient;
    staffId: string;
    ymd: string;
}) {
    const todayStart = `${ymd}T00:00:00`;
    const todayEnd = `${ymd}T23:59:59`;

    const { data, error } = await supabase
        .from('bookings')
        .select('id, client_name, client_phone, start_at, services:services!bookings_service_id_fkey (name_ru, name_ky, name_en)')
        .eq('staff_id', staffId)
        .gte('start_at', todayStart)
        .lte('start_at', todayEnd)
        .neq('status', 'cancelled')
        .order('start_at', { ascending: true });

    if (error) {
        logError('StaffShiftToday', 'Error loading today bookings', error);
    }

    return data ?? [];
}

async function loadAvailableServices({ supabase, staffId }: { supabase: SupabaseClient; staffId: string }) {
    const { data, error } = await supabase
        .from('service_staff')
        .select('services:services!inner (name_ru, name_ky, name_en)')
        .eq('staff_id', staffId)
        .eq('is_active', true)
        .eq('services.active', true);

    if (error) {
        logError('StaffShiftToday', 'Error loading staff services', error);
    }

    return (data ?? [])
        .map(
            (entry: {
                services:
                    | { name_ru: string; name_ky?: string | null; name_en?: string | null }
                    | { name_ru: string; name_ky?: string | null; name_en?: string | null }[]
                    | null;
            }) => {
                const service = Array.isArray(entry.services) ? entry.services[0] : entry.services;
                return service
                    ? {
                          name_ru: service.name_ru,
                          name_ky: service.name_ky ?? null,
                          name_en: service.name_en ?? null,
                      }
                    : null;
            },
        )
        .filter(
            (
                service: { name_ru: string; name_ky: string | null; name_en: string | null } | null,
            ): service is { name_ru: string; name_ky: string | null; name_en: string | null } =>
                !!service,
        );
}

function calculateCurrentWork({
    shift,
    hourlyRate,
    now,
}: {
    shift: { status?: string; opened_at?: string | null } | null;
    hourlyRate: number | null;
    now: Date;
}) {
    if (!shift || shift.status !== 'open' || !shift.opened_at || !hourlyRate) {
        return {
            currentHoursWorked: null,
            currentGuaranteedAmount: null,
        };
    }

    const openedAt = new Date(shift.opened_at);
    const diffMs = now.getTime() - openedAt.getTime();
    const currentHoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    const currentGuaranteedAmount = Math.round(currentHoursWorked * hourlyRate * 100) / 100;

    return {
        currentHoursWorked,
        currentGuaranteedAmount,
    };
}
