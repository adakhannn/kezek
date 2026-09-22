export async function loadWorkLocations(bizId: string, from: string, to: string, manager = false) {
    const query = new URLSearchParams({ bizId, from, to });
    const response = await fetch(`${manager ? '/api/staff/work-locations' : '/api/public/work-locations'}?${query}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'Не удалось загрузить филиалы сотрудников.');
    return payload.data as { staff_id: string; branch_id: string; date_on: string }[];
}
