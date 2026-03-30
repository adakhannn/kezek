/**
 * Централизованный фасад auth/business контекста.
 * Реализация разнесена по модулям user-role profile и cabinet access,
 * а этот файл сохраняет прежний публичный контракт.
 */

export {
    MANAGER_ROLE_KEYS,
    getUserRoleProfile,
} from './userRoleProfile';

export type {
    BusinessWithRole,
    ManagerRoleKey,
    UserRoleProfile,
} from './userRoleProfile';

export {
    countAvailableCabinetTypes,
    getPathForPreferredCabinet,
    pathToPreferredCabinet,
    PREFERRED_CABINET_COOKIE_NAME,
    resolveDefaultDashboard,
    shouldRedirectToSelectBusiness,
} from './cabinetAccess';

export type {
    DefaultDashboardResult,
    PreferredCabinet,
} from './cabinetAccess';
