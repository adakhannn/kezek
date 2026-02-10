/**
 * Утилиты для проверки прав доступа на клиенте
 */

export interface PermissionContext {
    staffId?: string; // Если передан, это владелец просматривает смену сотрудника
    isOpen: boolean; // Смена открыта
    isClosed: boolean; // Смена закрыта
    isReadOnly?: boolean; // Явный флаг только для чтения
}

export interface PermissionResult {
    canEdit: boolean;
    canAdd: boolean;
    canDelete: boolean;
    canOpenShift: boolean;
    canCloseShift: boolean;
    reason?: string; // Причина, почему действие недоступно
}

/**
 * Проверяет права доступа для различных действий
 */
export function checkPermissions(context: PermissionContext): PermissionResult {
    const { staffId, isOpen, isClosed, isReadOnly } = context;
    
    // Если явно установлен флаг только для чтения
    if (isReadOnly) {
        return {
            canEdit: false,
            canAdd: false,
            canDelete: false,
            canOpenShift: false,
            canCloseShift: false,
            reason: staffId 
                ? 'Смена закрыта. Закрытые смены нельзя редактировать.'
                : 'Смена закрыта. Закрытые смены нельзя редактировать.'
        };
    }
    
    // Для владельца (staffId передан)
    if (staffId) {
        // Владелец может редактировать открытые смены или смены, которые еще не созданы
        // Владелец НЕ может редактировать закрытые смены
        if (isClosed) {
            return {
                canEdit: false,
                canAdd: false,
                canDelete: false,
                canOpenShift: false,
                canCloseShift: false,
                reason: 'Смена закрыта. Закрытые смены нельзя редактировать.'
            };
        }
        
        // Владелец может открывать смены, если они еще не открыты
        return {
            canEdit: true,
            canAdd: true,
            canDelete: true,
            canOpenShift: !isOpen,
            canCloseShift: isOpen,
            reason: undefined
        };
    }
    
    // Для сотрудника (staffId не передан)
    // Сотрудник может редактировать только открытые смены
    if (!isOpen) {
        return {
            canEdit: false,
            canAdd: false,
            canDelete: false,
            canOpenShift: !isClosed, // Может открыть, если смена не закрыта
            canCloseShift: false,
            reason: 'Смена не открыта. Сначала откройте смену на вкладке «Текущая смена».'
        };
    }
    
    // Смена открыта - сотрудник может редактировать
    return {
        canEdit: true,
        canAdd: true,
        canDelete: true,
        canOpenShift: false, // Смена уже открыта
        canCloseShift: true,
        reason: undefined
    };
}

/**
 * Получает понятное сообщение о том, почему действие недоступно
 */
export function getPermissionMessage(
    action: 'edit' | 'add' | 'delete' | 'open' | 'close',
    context: PermissionContext
): string | undefined {
    const permissions = checkPermissions(context);
    
    switch (action) {
        case 'edit':
            if (!permissions.canEdit) {
                return permissions.reason || 'Редактирование недоступно';
            }
            break;
        case 'add':
            if (!permissions.canAdd) {
                return permissions.reason || 'Добавление клиентов недоступно';
            }
            break;
        case 'delete':
            if (!permissions.canDelete) {
                return permissions.reason || 'Удаление клиентов недоступно';
            }
            break;
        case 'open':
            if (!permissions.canOpenShift) {
                return context.isClosed 
                    ? 'Смена уже закрыта. Закрытые смены нельзя открыть снова.'
                    : context.isOpen
                    ? 'Смена уже открыта.'
                    : 'Открытие смены недоступно';
            }
            break;
        case 'close':
            if (!permissions.canCloseShift) {
                return context.isClosed
                    ? 'Смена уже закрыта.'
                    : !context.isOpen
                    ? 'Смена не открыта. Сначала откройте смену.'
                    : 'Закрытие смены недоступно';
            }
            break;
    }
    
    return undefined;
}

