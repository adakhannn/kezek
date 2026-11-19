/**
 * Утилиты для проверки прав доступа на клиенте
 */

export interface PermissionContext {
    staffId?: string; // Если передан, это владелец просматривает смену сотрудника
    isOpen: boolean; // Смена открыта
    isClosed: boolean; // Смена закрыта
    isReadOnly?: boolean; // Явный флаг только для чтения
}

/** Why an action is unavailable, as a staff dictionary key (FE-10). */
export type PermissionReasonKey =
    | 'staff.finance.permissions.closed'
    | 'staff.finance.permissions.ownerNotOpen'
    | 'staff.finance.permissions.staffNotOpen';

export interface PermissionResult {
    canEdit: boolean;
    canAdd: boolean;
    canDelete: boolean;
    canOpenShift: boolean;
    canCloseShift: boolean;
    reasonKey?: PermissionReasonKey;
}

type Translate = (key: string, fallback: string) => string;

/**
 * Проверяет права доступа для различных действий
 */
export function checkPermissions(context: PermissionContext): PermissionResult {
    const { staffId, isOpen, isClosed, isReadOnly } = context;
    const none = { canEdit: false, canAdd: false, canDelete: false, canOpenShift: false, canCloseShift: false };

    // Явный флаг только для чтения, и владелец не меняет закрытые смены
    if (isReadOnly || (staffId && isClosed)) {
        return { ...none, reasonKey: 'staff.finance.permissions.closed' };
    }

    // Для владельца: открыть можно не открытую смену, клиенты — только при ОТКРЫТОЙ смене.
    if (staffId) {
        return {
            canEdit: isOpen,
            canAdd: isOpen,
            canDelete: isOpen,
            canOpenShift: !isOpen,
            canCloseShift: isOpen,
            reasonKey: isOpen ? undefined : 'staff.finance.permissions.ownerNotOpen',
        };
    }

    // Сотрудник редактирует только открытые смены
    if (!isOpen) {
        return { ...none, canOpenShift: !isClosed, reasonKey: 'staff.finance.permissions.staffNotOpen' };
    }

    return { canEdit: true, canAdd: true, canDelete: true, canOpenShift: false, canCloseShift: true };
}

function reasonText(key: PermissionReasonKey, t: Translate): string {
    switch (key) {
        case 'staff.finance.permissions.closed':
            return t(key, 'Смена закрыта. Закрытые смены нельзя редактировать.');
        case 'staff.finance.permissions.ownerNotOpen':
            return t(key, 'Смена не открыта. Сначала откройте смену, чтобы добавлять клиентов.');
        case 'staff.finance.permissions.staffNotOpen':
            return t(key, 'Смена не открыта. Сначала откройте смену на вкладке «Текущая смена».');
    }
}

/**
 * Понятное сообщение о том, почему действие недоступно, на языке интерфейса
 */
export function getPermissionMessage(
    action: 'edit' | 'add' | 'delete' | 'open' | 'close',
    context: PermissionContext,
    t: Translate,
): string | undefined {
    const permissions = checkPermissions(context);
    const reason = permissions.reasonKey ? reasonText(permissions.reasonKey, t) : undefined;

    switch (action) {
        case 'edit':
            return permissions.canEdit ? undefined : reason || t('staff.finance.permissions.editUnavailable', 'Редактирование недоступно');
        case 'add':
            return permissions.canAdd ? undefined : reason || t('staff.finance.permissions.addUnavailable', 'Добавление клиентов недоступно');
        case 'delete':
            return permissions.canDelete ? undefined : reason || t('staff.finance.permissions.deleteUnavailable', 'Удаление клиентов недоступно');
        case 'open':
            if (permissions.canOpenShift) return undefined;
            if (context.isClosed) return t('staff.finance.permissions.openClosed', 'Смена уже закрыта. Закрытые смены нельзя открыть снова.');
            if (context.isOpen) return t('staff.finance.permissions.alreadyOpen', 'Смена уже открыта.');
            return t('staff.finance.permissions.openUnavailable', 'Открытие смены недоступно');
        case 'close':
            if (permissions.canCloseShift) return undefined;
            if (context.isClosed) return t('staff.finance.permissions.alreadyClosed', 'Смена уже закрыта.');
            if (!context.isOpen) return t('staff.finance.permissions.closeNotOpen', 'Смена не открыта. Сначала откройте смену.');
            return t('staff.finance.permissions.closeUnavailable', 'Закрытие смены недоступно');
    }
}
