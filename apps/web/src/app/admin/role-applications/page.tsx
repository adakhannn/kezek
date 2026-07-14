import { RoleApplicationsAdminClient } from './RoleApplicationsAdminClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function AdminRoleApplicationsPage() {
    return (
        <div className="space-y-6">
            <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">
                    Доступы
                </p>
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                    Заявки на роли в бизнесах
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                    Супер-админ рассматривает заявки владельцев и может обработать любую заявку на доступ.
                    После одобрения система выдаёт роль выбранному аккаунту.
                </p>
            </div>
            <RoleApplicationsAdminClient />
        </div>
    );
}
