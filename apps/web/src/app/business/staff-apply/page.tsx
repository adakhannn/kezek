import { RoleApplicationForm } from '../role-apply/RoleApplicationForm';

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffApplicationPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
            <div className="mb-6 text-center">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                    Доступ для команды
                </p>
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                    Заявка сотрудника, менеджера или администратора
                </h1>
                <p className="mt-2 text-[var(--text-secondary)]">
                    Выберите существующий бизнес и нужный уровень доступа. Заявку рассмотрит владелец или администратор этого бизнеса.
                </p>
            </div>
            <RoleApplicationForm isAuthenticated={!!user} mode="staff" />
        </main>
    );
}
