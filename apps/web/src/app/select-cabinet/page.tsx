import { redirect } from 'next/navigation';

import { SelectCabinetClient, type CabinetOption } from './SelectCabinetClient';

import { countAvailableCabinetTypes, getUserRoleProfile } from '@/lib/authContext';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';

export default async function SelectCabinetPage() {
    const supabase = await createSupabaseServerClient();

    const profile = await getUserRoleProfile(supabase);
    if (!profile) {
        redirect('/');
    }

    const count = countAvailableCabinetTypes(profile);
    if (count < 2) {
        redirect('/');
    }

    const options: CabinetOption[] = [];
    if (profile.canAdmin) {
        options.push({ path: '/admin', labelKey: 'selectCabinet.optionAdmin' });
    }
    if (profile.canDashboard) {
        options.push({ path: '/dashboard', labelKey: 'selectCabinet.optionDashboard' });
    }
    if (profile.canStaff) {
        options.push({ path: '/staff', labelKey: 'selectCabinet.optionStaff' });
    }
    if (profile.canCabinet) {
        options.push({ path: '/cabinet', labelKey: 'selectCabinet.optionCabinet' });
    }

    return <SelectCabinetClient options={options} />;
}
