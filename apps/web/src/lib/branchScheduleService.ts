import type { DbTableClient } from '@/lib/supabaseTypes';

export type ScheduleItem = {
  day_of_week: number;
  intervals: Array<{ start: string; end: string }>;
  breaks: Array<{ start: string; end: string }>;
};

export type BranchScheduleBody = {
  schedule: ScheduleItem[];
};

export type BranchScheduleAdminLike = DbTableClient;

export type BranchScheduleResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: 'validation' | 'not_found';
      message: string;
      status: number;
    };

async function ensureBranchBelongsToBiz(
  admin: BranchScheduleAdminLike,
  branchId: string,
  bizId: string,
) {
  const { data: branch, error: branchError } = await admin
    .from('branches')
    .select('id, biz_id')
    .eq('id', branchId)
    .eq('biz_id', bizId)
    .maybeSingle();

  if (branchError) {
    return {
      ok: false as const,
      error: 'validation' as const,
      message: branchError.message,
      status: 400,
    };
  }
  if (!branch) {
    return {
      ok: false as const,
      error: 'not_found' as const,
      message: 'Филиал не найден',
      status: 404,
    };
  }

  return { ok: true as const };
}

export async function getBranchSchedule(params: {
  admin: BranchScheduleAdminLike;
  branchId: string;
  bizId: string;
}): Promise<BranchScheduleResult<{ schedule: ScheduleItem[] }>> {
  const ownership = await ensureBranchBelongsToBiz(params.admin, params.branchId, params.bizId);
  if (!ownership.ok) {
    return ownership;
  }

  const { data: schedule, error: scheduleError } = await params.admin
    .from('branch_working_hours')
    .select('day_of_week, intervals, breaks')
    .eq('biz_id', params.bizId)
    .eq('branch_id', params.branchId)
    .order('day_of_week');

  if (scheduleError) {
    return {
      ok: false,
      error: 'validation',
      message: scheduleError.message,
      status: 400,
    };
  }

  return {
    ok: true,
    data: {
      // intervals/breaks are jsonb; saveBranchSchedule writes them in the ScheduleItem shape.
      schedule: (schedule || []) as ScheduleItem[],
    },
  };
}

export async function saveBranchSchedule(params: {
  admin: BranchScheduleAdminLike;
  branchId: string;
  bizId: string;
  body: BranchScheduleBody;
}): Promise<BranchScheduleResult<Record<string, never>>> {
  const ownership = await ensureBranchBelongsToBiz(params.admin, params.branchId, params.bizId);
  if (!ownership.ok) {
    return ownership;
  }

  if (!Array.isArray(params.body.schedule)) {
    return {
      ok: false,
      error: 'validation',
      message: 'schedule должен быть массивом',
      status: 400,
    };
  }

  await params.admin.from('branch_working_hours').delete().eq('biz_id', params.bizId).eq('branch_id', params.branchId);

  const inserts = params.body.schedule
    .filter((s) => s.intervals.length > 0)
    .map((s) => ({
      biz_id: params.bizId,
      branch_id: params.branchId,
      day_of_week: s.day_of_week,
      intervals: s.intervals,
      breaks: s.breaks || [],
    }));

  if (inserts.length > 0) {
    const { error: insertError } = await params.admin.from('branch_working_hours').insert(inserts);
    if (insertError) {
      return {
        ok: false,
        error: 'validation',
        message: insertError.message,
        status: 400,
      };
    }
  }

  return {
    ok: true,
    data: {},
  };
}
