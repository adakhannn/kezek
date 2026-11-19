// Server messages (FE-10): each value is the exact Russian text a service returns in an API response, or a
// pattern of it with {placeholders}; ky and en translate it. Not part of the client bundle: only
// src/lib/serverMessages.ts imports these, to answer in the language of the request.
export const serverCommonEn = {
    'server.common.staffSelectionRequired': 'Choose a business in the staff account',
    'server.common.noStaffAccess': 'No access to the staff account',
    'server.common.accessDenied': 'Access denied',
    'server.common.dataConflict': 'Data conflict',
    'server.common.validationError': 'Validation error',
    'server.common.notAuthorized': 'Not signed in',
    'server.common.authUnavailable': 'The sign-in service is temporarily unavailable. Please try again later.',
    'server.common.noBusinessAccess': 'No access to this business',
    'server.common.notFound': 'Not found',
    'server.common.internalError': 'Internal server error',
    'server.common.rateLimitUnavailable': 'Rate limit checks are temporarily unavailable. Please try again later.',
    'server.common.rateLimited': 'Too many requests. Try again in {seconds} seconds.',
    'server.common.authRequired': 'Sign-in required',
    'server.common.noManagerAccess': 'No access to the management account',
    'server.common.staffIdMissing': 'Staff ID is missing',
    'server.common.staffNotFoundOrForbidden': 'Staff member not found or access denied',
} as const;
