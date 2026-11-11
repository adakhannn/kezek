import { z } from 'zod';

const contactShape = {
    contact_phone: z.string().max(100).nullable().optional(),
    contact_whatsapp: z.string().max(100).nullable().optional(),
    contact_email: z.string().max(254).nullable().optional(),
    website_url: z.string().max(2048).nullable().optional(),
};

export const publicContactPatchSchema = z.object(contactShape).strict()
    .refine((value) => Object.keys(value).length > 0, 'Укажите поля для изменения');

// Every update endpoint uses PATCH semantics, including legacy POST/PUT aliases.
// Omitted fields are preserved; null explicitly clears nullable fields.
export const branchUpdateSchema = z.object({
    ...contactShape,
    name: z.string().trim().min(1, 'Имя обязательно').max(200).optional(),
    address: z.string().trim().max(2000).nullable().optional(),
    is_active: z.boolean().optional(),
    inherit_business_contacts: z.boolean().optional(),
    lat: z.number().finite().min(-90).max(90).nullable().optional(),
    lon: z.number().finite().min(-180).max(180).nullable().optional(),
    directory_links: z.record(z.string(), z.string().max(2048).nullable()).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Укажите поля для изменения')
    .refine((value) => {
        const latPresent = Object.hasOwn(value, 'lat');
        const lonPresent = Object.hasOwn(value, 'lon');
        return latPresent === lonPresent && (!latPresent || (value.lat === null) === (value.lon === null));
    }, 'Координаты lat и lon передаются вместе: два числа или два null');

export const businessUpdateSchema = z.object({
    ...contactShape,
    name: z.string().trim().min(1).max(200).optional(),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200).optional(),
    categories: z.array(z.string().trim().min(1)).max(100).nullable().optional(),
    address: z.string().trim().max(2000).nullable().optional(),
    phones: z.array(z.string().trim().min(1).max(100)).max(100).nullable().optional(),
    is_approved: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Укажите поля для изменения');
