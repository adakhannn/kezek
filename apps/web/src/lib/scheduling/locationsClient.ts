export type WorkLocation = { staff_id: string; branch_id: string; date_on: string };

export async function loadWorkLocationSnapshot(bizId: string, from: string, to: string, manager = false) {
    const query = new URLSearchParams({ bizId, from, to });
    const response = await fetch(`${manager ? '/api/staff/work-locations' : '/api/public/work-locations'}?${query}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'Не удалось загрузить филиалы сотрудников.');
    if (!Array.isArray(payload.data)) throw new Error('Invalid work-location response');
    return { locations: payload.data as WorkLocation[], complete: payload.availabilityComplete === true };
}

export async function loadWorkLocations(bizId: string, from: string, to: string, manager = false) {
    return (await loadWorkLocationSnapshot(bizId, from, to, manager)).locations;
}
