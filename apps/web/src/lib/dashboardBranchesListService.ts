export type DashboardBranchesListResult =
  | { ok: true; data: Array<{ id: string; name: string }> }
  | { ok: false; error: 'server'; message: string; details?: unknown; status: number };

export async function listDashboardBranches({
  supabase,
  bizId,
}: {
  supabase: any;
  bizId: string;
}): Promise<DashboardBranchesListResult> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .eq('biz_id', bizId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    return {
      ok: false,
      error: 'server',
      message: 'Failed to load branches',
      details: error.message,
      status: 500,
    };
  }

  return {
    ok: true,
    data: (data ?? []).map((branch: { id: string | number; name: string | null }) => ({
      id: String(branch.id),
      name: String(branch.name ?? ''),
    })),
  };
}
