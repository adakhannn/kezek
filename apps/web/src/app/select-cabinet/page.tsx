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
        options.push({ path: '/admin', labelKey: 'selectCabinet.optionAdmin', defaultLabel: 'Админ-панель' });
    }
    if (profile.canDashboard) {
        options.push({ path: '/dashboard', labelKey: 'selectCabinet.optionDashboard', defaultLabel: 'Кабинет бизнеса' });
    }
    if (profile.canStaff) {
        options.push({ path: '/staff', labelKey: 'selectCabinet.optionStaff', defaultLabel: 'Кабинет сотрудника' });
    }
    if (profile.canCabinet) {
        options.push({ path: '/cabinet', labelKey: 'selectCabinet.optionCabinet', defaultLabel: 'Мои записи' });
    }

    return <SelectCabinetClient options={options} />;
}
