import { Tabs, type TabItem } from '@/components/ui/Tabs';

type AdminEntity = 'businesses' | 'categories' | 'users' | 'roles';

type AdminEntityFlowTabsProps = {
    entity: AdminEntity;
    detailHref?: string;
    className?: string;
};

function getEntityTabs(entity: AdminEntity, detailHref?: string): TabItem[] {
    if (entity === 'businesses') {
        return [
            { key: 'businesses-list', label: 'Список', href: '/admin/businesses' },
            { key: 'businesses-new', label: 'Создать', href: '/admin/businesses/new' },
            ...(detailHref ? [{ key: 'businesses-detail', label: 'Карточка', href: detailHref }] : []),
        ];
    }

    if (entity === 'categories') {
        return [
            { key: 'categories-list', label: 'Список', href: '/admin/categories' },
            { key: 'categories-new', label: 'Создать', href: '/admin/categories/new' },
            ...(detailHref ? [{ key: 'categories-detail', label: 'Редактирование', href: detailHref }] : []),
        ];
    }

    if (entity === 'roles') {
        return [
            { key: 'roles-list', label: 'Список', href: '/admin/roles' },
            { key: 'roles-new', label: 'Создать', href: '/admin/roles/new' },
            ...(detailHref ? [{ key: 'roles-detail', label: 'Редактирование', href: detailHref }] : []),
        ];
    }

    return [
        { key: 'users-list', label: 'Список', href: '/admin/users' },
        ...(detailHref ? [{ key: 'users-detail', label: 'Профиль', href: detailHref }] : []),
    ];
}

export function AdminEntityFlowTabs({ entity, detailHref, className }: AdminEntityFlowTabsProps) {
    return <Tabs items={getEntityTabs(entity, detailHref)} value="" stretch className={className} />;
}

