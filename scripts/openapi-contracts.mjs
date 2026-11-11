// Reviewed HTTP wire contracts. No application imports, environment or network reads.
// Keep these descriptions aligned with the listed sources; check:openapi detects drift.
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const object = (properties, required = [], extra = {}) => ({ type: 'object', properties, ...(required.length ? { required } : {}), ...extra });
const uuid = { type: 'string', format: 'uuid' };
const revision = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const amount = { type: 'number', minimum: 0, maximum: 100000000 };
const nullable = schema => ({ ...schema, nullable: true });
const success = data => object({ ok: { type: 'boolean', enum: [true] }, data }, ['ok', 'data']);
const json = schema => ({ 'application/json': { schema } });
const bookingProperties = {
    biz_id: uuid, branch_id: uuid, staff_id: uuid, service_id: uuid,
    services: { type: 'array', minItems: 1, items: ref('BookingServiceInput') },
    start_at: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(Z|[+-]\\d{2}:?\\d{2})$', description: 'A valid date with seconds and timezone; fractional seconds are not accepted by the HTTP validator.' },
};
const serviceChoice = [{ required: ['service_id'] }, { required: ['services'] }];
const commonBookingRequired = ['biz_id', 'staff_id', 'start_at'];
const items = { type: 'array', maxItems: 1000, items: ref('ShiftItemInput') };

export const schemas = {
    ApiErrorEnvelope: object({ ok: { type: 'boolean', enum: [false] }, error: { type: 'string' }, message: { type: 'string' }, details: {} }, ['ok', 'error']),
    BookingServiceInput: object({ service_id: uuid, duration_min: { type: 'integer', minimum: 1 }, order_index: { type: 'integer', minimum: 0 } }, ['service_id', 'duration_min']),
    QuickHoldInput: object(bookingProperties, commonBookingRequired, { anyOf: serviceChoice, description: 'Either service_id or a non-empty services array is required. If services is supplied it must be non-empty even when service_id is also supplied. Unknown keys are stripped. Calendar, schedule and tenant validity are enforced by the server.' }),
    QuickBookGuestInput: object({ ...bookingProperties, client_name: { type: 'string', minLength: 2, maxLength: 100, description: 'Must contain non-whitespace characters.' }, client_phone: { type: 'string', pattern: '^\\+[1-9]\\d{7,14}$' }, client_email: { type: 'string', format: 'email', maxLength: 255, nullable: true } }, [...commonBookingRequired, 'branch_id', 'client_name', 'client_phone'], { anyOf: serviceChoice, description: 'Unknown keys are stripped. Business rules and service availability are validated on the server.' }),
    BookingSuccess: success(object({ booking_id: { type: 'string' }, confirmed: { type: 'boolean', enum: [true] } }, ['booking_id', 'confirmed'])),
    ShiftItemInput: object({
        id: nullable(uuid), clientId: { ...uuid, description: 'Stable client-generated identity for a new draft row.' },
        clientName: { type: 'string', maxLength: 200, nullable: true }, serviceName: { type: 'string', maxLength: 200, nullable: true },
        serviceAmount: { ...amount, default: 0 }, consumablesAmount: { ...amount, default: 0 },
        bookingId: nullable(uuid), createdAt: { type: 'string', nullable: true },
    }, [], { additionalProperties: false, description: 'No note field is accepted. Amounts may be fractional. Omitted amounts default to zero.' }),
    SaveShiftItemsInput: object({ items, staffId: uuid, shiftDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'A real calendar date in 1900..2100.' }, expectedShiftId: nullable(uuid), expectedRevision: nullable(revision) }, ['items', 'expectedShiftId', 'expectedRevision'], {
        additionalProperties: false,
        description: 'Both expected fields must refer to the draft snapshot. Both null only for a manager creating a previously absent shift on the current business-local day. For an existing shift, the stored shift date is authoritative; an explicit shiftDate must match it. Never rebase a stale draft automatically. staffId selects the manager cookie-session path; staff mode supports a verified bearer or cookie session.',
        oneOf: [
            { properties: { expectedShiftId: { type: 'string', nullable: true, enum: [null] }, expectedRevision: { type: 'integer', nullable: true, enum: [null] } } },
            { properties: { expectedShiftId: uuid, expectedRevision: revision } },
        ],
    }),
    SavedShiftItem: object({ id: uuid, clientName: { type: 'string' }, serviceName: { type: 'string' }, serviceAmount: { type: 'number' }, consumablesAmount: { type: 'number' }, bookingId: nullable(uuid), note: { type: 'string', nullable: true } }, ['id', 'clientName', 'serviceName', 'serviceAmount', 'consumablesAmount', 'bookingId']),
    SaveShiftItemsSuccess: success(object({ shiftId: { type: 'string' }, revision, items: { type: 'array', items: ref('SavedShiftItem') } }, ['shiftId', 'revision', 'items'])),
    CloseShiftInput: object({ expectedShiftId: uuid, expectedRevision: revision, items, totalAmount: { type: 'number', minimum: 0 }, consumablesAmount: { type: 'number', minimum: 0 } }, ['expectedShiftId', 'expectedRevision'], {
        additionalProperties: false,
        anyOf: [{ required: ['items'], properties: { items: { type: 'array', minItems: 1, items: ref('ShiftItemInput') } } }, { required: ['totalAmount'] }],
        description: 'The supplied items must match the saved ledger. Close finalizes saved positions; it does not save draft edits. A non-empty items array or totalAmount is required. Identity and revision belong to the original draft.',
    }),
    ClosedShift: object({ id: uuid, ledger_revision: revision, status: { type: 'string', enum: ['closed'] } }, ['id', 'ledger_revision', 'status'], { description: 'Only these fields are modeled for the SDK. The endpoint returns the stored staff_shifts row, with additional database fields.' }),
    CloseShiftSuccess: success(object({ shift: ref('ClosedShift') }, ['shift'])),
};

const errors = {
    400: 'Invalid JSON, identity, shape or domain parameters.',
    401: 'Verified session required or invalid.',
    403: 'Caller or linked resource is not allowed for this tenant.',
    409: 'Booking attempt/slot conflict, or stale shift identity/revision/ledger. Do not silently rebase a financial draft.',
    429: 'Rate limit exceeded; inspect Retry-After.',
    500: 'Unexpected or database command failure.',
    503: 'Dependency or rate-limit readiness failure. Booking transport uncertainty must retry the exact same identity and payload.',
};
const operation = (operationId, tag, summary, request, response, description, statusCodes) => ({
    operationId, tags: [tag], summary, description,
    requestBody: { required: true, content: json(ref(request)) },
    responses: { 200: { description: 'Success', content: json(ref(response)) }, ...Object.fromEntries(statusCodes.map(status => [status, { description: errors[status], content: json(ref('ApiErrorEnvelope')) }])) },
    'x-contract-status': 'reviewed',
    'x-unmodeled-responses': 'Other infrastructure/framework responses are outside this typed contract.',
});
const requestIdentity = { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', format: 'uuid', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' }, description: 'UUID v4 generated before sending. Reuse with identical payload for an uncertain response; a new attempt needs a new key.' };
const authenticated = { security: [{ bearerAuth: [] }], 'x-browser-auth': 'Existing verified Supabase cookie session is also accepted. Cookie names/chunking are deployment-specific and not modeled as a fixed cookie security scheme.' };
export const reviewedOperations = {
    'POST /api/quick-hold': {
        ...operation('quickHold', 'Bookings', 'Confirm an authenticated booking', 'QuickHoldInput', 'BookingSuccess', 'The legacy route name does not create a hold: it confirms the booking. Verified cookie/bearer session, mandatory request identity, atomic booking and notification enqueue. Repeating the same identity/payload resolves an uncertain result without creating another booking.', [400, 401, 409, 429, 500, 503]),
        ...authenticated, parameters: [requestIdentity],
    },
    'POST /api/quick-book-guest': {
        ...operation('quickBookGuest', 'Bookings', 'Confirm a guest booking', 'QuickBookGuestInput', 'BookingSuccess', 'No login required. The caller must retain both request identity and guest proof for exact retries. Confirmation commits a durable notification event; success does not mean a message has been delivered.', [400, 401, 409, 429, 500, 503]),
        security: [], parameters: [requestIdentity, { name: 'X-Booking-Client-Token', in: 'header', required: true, schema: { type: 'string', pattern: '^[a-f0-9]{64}$' }, description: '32 cryptographically random bytes encoded as lowercase hex, retained with this attempt. Never log it.' }],
    },
    'POST /api/staff/shift/items': {
        ...operation('saveShiftItems', 'Shifts', 'Replace a shift ledger using the original revision', 'SaveShiftItemsInput', 'SaveShiftItemsSuccess', 'Authenticated staff may save their existing shift; staffId selects manager cookie-session authorization for a tenant-owned staff member. Saves are atomic and return canonical rows/revision. A 409 requires explicit review of the preserved draft against a fresh snapshot. Serialize Save and Close; an uncertain response is not permission to overwrite using a new revision.', [400, 401, 403, 409, 429, 500, 503]),
        ...authenticated,
    },
    'POST /api/staff/shift/close': {
        ...operation('closeShift', 'Shifts', 'Close the current staff shift', 'CloseShiftInput', 'CloseShiftSuccess', 'Verified staff context. Finalizes the saved ledger under an identity/revision guard. Repeating Close for the same already-closed shift returns it; a reopened shift with an old revision conflicts. Additional notification work after the commit is not a delivery guarantee.', [400, 401, 403, 409, 429, 500, 503]),
        ...authenticated,
    },
};

export const reviewedSources = [
    'scripts/openapi-contracts.mjs',
    'apps/web/src/lib/validation/bookingSchemas.ts', 'apps/web/src/lib/validation/schemas.ts',
    'apps/web/src/lib/validation/apiValidation.ts', 'apps/web/src/lib/apiErrorHandler.ts',
    'packages/core-domain/src/booking/validation.ts', 'apps/web/src/lib/bookingRequestHttp.ts',
    'apps/web/src/lib/bookingRequestService.ts', 'apps/web/src/lib/quickHoldHttpService.ts',
    'apps/web/src/lib/quickBookGuestHttpService.ts', 'apps/web/src/lib/quickHoldService.ts', 'apps/web/src/lib/quickBookGuestService.ts',
    'apps/web/src/lib/requestAuthContext.ts', 'apps/web/src/lib/authBiz.ts', 'apps/web/src/lib/rateLimit.ts',
    'apps/web/src/lib/staffShiftItemsHttpService.ts', 'apps/web/src/lib/staffShiftItemsRouteService.ts',
    'apps/web/src/lib/staffShiftItemsService.ts', 'apps/web/src/lib/staffShiftCloseHttpService.ts',
    'apps/web/src/lib/staffShiftCloseService.ts', 'apps/web/src/lib/staffShift/financeCommand.ts',
    'supabase/migrations/20261110100000_finance_draft_revision.sql',
    'supabase/migrations/20261109091100_atomic_shift_commands.sql',
    'supabase/migrations/20261110101000_atomic_booking_requests.sql',
    'supabase/migrations/20261110114000_finance_calendar.sql',
    'supabase/migrations/20261110123000_service_only_booking_commands.sql',
];
