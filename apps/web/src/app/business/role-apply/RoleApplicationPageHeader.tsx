'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type RoleApplicationPageHeaderProps = {
    mode: 'owner' | 'staff';
};

export function RoleApplicationPageHeader({ mode }: RoleApplicationPageHeaderProps) {
    const { t } = useLanguage();
    const key = mode === 'staff' ? 'business.roleApply.staffPage' : 'business.roleApply.ownerPage';

    return (
        <div className="mb-6 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                {t(`${key}.eyebrow`)}
            </p>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                {t(`${key}.title`)}
            </h1>
            <p className="mt-2 text-[var(--text-secondary)]">
                {t(`${key}.description`)}
            </p>
        </div>
    );
}
