import { RoleApplicationForm } from '../role-apply/RoleApplicationForm';

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function OwnerApplicationPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
            <div className="mb-6 text-center">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                    Подтверждение владельца
                </p>
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                    Заявка владельца существующего бизнеса
                </h1>
                <p className="mt-2 text-[var(--text-secondary)]">
                    Выберите бизнес, который уже есть в Kezek, и отправьте заявку. После проверки супер-админ привяжет роль владельца к вашему аккаунту.
                </p>
            </div>
            <RoleApplicationForm isAuthenticated={!!user} mode="owner" />
        </main>
    );
}
