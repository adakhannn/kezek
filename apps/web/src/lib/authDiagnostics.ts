/**
 * Типизированные коды ошибок доступа/авторизации
 */
export type AuthErrorCode =
    | 'NOT_AUTHENTICATED'
    | 'NO_BIZ_ACCESS'
    | 'NO_STAFF_RECORD'
    | 'NO_STAFF_ACCESS'
    | 'STAFF_ROLE_MISMATCH';

/**
 * Кастомный класс ошибки доступа к бизнесу с диагностикой
 */
export class BizAccessError extends Error {
    public readonly code: AuthErrorCode;
    public readonly diagnostics?: {
        checkedSuperAdmin?: boolean;
        checkedUserRoles?: boolean;
        checkedOwnerId?: boolean;
        currentBizId?: string | null;
        hasCurrentBizRecord?: boolean;
        currentBizHasAllowedRole?: boolean;
        userRolesFound?: number;
        eligibleRolesFound?: number;
        ownedBusinessesFound?: number;
        errorsCount?: number;
    };

    constructor(code: AuthErrorCode, message?: string, diagnostics?: BizAccessError['diagnostics']) {
        super(message ?? code);
        this.name = 'BizAccessError';
        this.code = code;
        this.diagnostics = diagnostics;
    }
}

