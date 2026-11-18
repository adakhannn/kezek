/**
 * Typed auth/access error codes shared across manager and staff flows.
 */
export type AuthErrorCode =
    | 'NOT_AUTHENTICATED'
    | 'SERVICE_UNAVAILABLE'
    | 'NO_BIZ_ACCESS'
    | 'NO_STAFF_RECORD'
    | 'NO_STAFF_ACCESS'
    | 'STAFF_SELECTION_REQUIRED'
    | 'STAFF_ROLE_MISMATCH';

/**
 * Stable diagnostics payload attached to NO_BIZ_ACCESS errors.
 */
export interface BizAccessDiagnostics {
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
}

/**
 * Access error with typed code and optional diagnostics.
 */
export class BizAccessError extends Error {
    public readonly code: AuthErrorCode;
    public readonly diagnostics?: BizAccessDiagnostics;

    constructor(code: AuthErrorCode, message?: string, diagnostics?: BizAccessDiagnostics) {
        super(message ?? code);
        this.name = 'BizAccessError';
        this.code = code;
        this.diagnostics = diagnostics;
    }
}

/**
 * One of the caller's active staff cards (one per business).
 */
export type StaffOption = {
    staffId: string;
    bizId: string;
    branchId: string | null;
};

/**
 * The caller is an active master in several businesses and no card was chosen (ARCH-02).
 * Carries the cards to choose from; never a generic access failure.
 */
export class StaffSelectionRequiredError extends BizAccessError {
    public readonly staffOptions: StaffOption[];

    constructor(staffOptions: StaffOption[]) {
        super('STAFF_SELECTION_REQUIRED');
        this.name = 'StaffSelectionRequiredError';
        this.staffOptions = staffOptions;
    }
}
