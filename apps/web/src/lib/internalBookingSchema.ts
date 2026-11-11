import { z } from 'zod';

import { uuidSchema, isoDateTimeSchema } from '@/lib/validation/schemas';

const common = {
    biz_id: uuidSchema, branch_id: uuidSchema, staff_id: uuidSchema, start_at: isoDateTimeSchema,
    client_id: uuidSchema.nullable(), client_name: z.string().trim().max(100).nullable(),
    client_phone: z.string().trim().max(32).nullable(), client_email: z.string().trim().email().max(254).nullable().optional(),
};
export const internalBookingSchema = z.discriminatedUnion('mode', [
    z.object({ ...common, mode: z.literal('simple'), service_id: uuidSchema, duration_min: z.number().int().min(1).max(1440) }).strict(),
    z.object({ ...common, mode: z.literal('complex'), services: z.array(z.object({
        service_id: uuidSchema, duration_min: z.number().int().min(1).max(1440), order_index: z.number().int().min(0).max(19).optional(),
    }).strict()).min(1).max(20) }).strict(),
]);
export type InternalBookingInput = z.infer<typeof internalBookingSchema>;
