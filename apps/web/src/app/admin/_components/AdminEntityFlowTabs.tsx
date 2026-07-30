'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Tabs, type TabItem } from '@/components/ui/Tabs';

type AdminEntity = 'businesses' | 'categories' | 'users' | 'roles';

type AdminEntityFlowTabsProps = {
    entity: AdminEntity;
    detailHref?: string;
    className?: string;
};

type Translate = ReturnType<typeof useLanguage>['t'];

function getEntityTabs(entity: AdminEntity, t: Translate, detailHref?: string): TabItem[] {
    if (entity === 'businesses') {
        return [
            { key: 'businesses-list', label: t('admin.entityTabs.list'), href: '/admin/businesses' },
            ...(detailHref ? [{ key: 'businesses-detail', label: t('admin.entityTabs.card'), href: detailHref }] : []),
        ];
    }

    if (entity === 'categories') {
        return [
            { key: 'categories-list', label: t('admin.entityTabs.list'), href: '/admin/categories' },
            { key: 'categories-new', label: t('admin.entityTabs.create'), href: '/admin/categories/new' },
            ...(detailHref ? [{ key: 'categories-detail', label: t('admin.entityTabs.edit'), href: detailHref }] : []),
        ];
    }

    if (entity === 'roles') {
        return [
            { key: 'roles-list', label: t('admin.entityTabs.list'), href: '/admin/roles' },
            { key: 'roles-new', label: t('admin.entityTabs.create'), href: '/admin/roles/new' },
            ...(detailHref ? [{ key: 'roles-detail', label: t('admin.entityTabs.edit'), href: detailHref }] : []),
        ];
    }

    return [
        { key: 'users-list', label: t('admin.entityTabs.list'), href: '/admin/users' },
        ...(detailHref ? [{ key: 'users-detail', label: t('admin.entityTabs.profile'), href: detailHref }] : []),
    ];
}

export function AdminEntityFlowTabs({ entity, detailHref, className }: AdminEntityFlowTabsProps) {
    const { t } = useLanguage();
    return <Tabs items={getEntityTabs(entity, t, detailHref)} value="" stretch className={className} />;
}
