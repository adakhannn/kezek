import { getSiteOrigin } from '@/lib/env';
import { getLocalAuthPublicOrigin } from '@/lib/localAuthPublicOrigin';

/** Notifications must use a configured public origin, never an internal proxy
 * address or an untrusted request Host header. The local override is dev-only. */
export function getApplicationNotificationOrigin(): string {
    return getLocalAuthPublicOrigin(getSiteOrigin());
}

export function getApplicationTemplateParameterNames(key: string): string[] {
    const raw = process.env.WHATSAPP_APPLICATION_NAMED_PARAMETERS?.trim();
    if (!raw) return [];
    const config: unknown = JSON.parse(raw);
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('Invalid WhatsApp named parameter configuration');
    }
    const names = (config as Record<string, unknown>)[key];
    if (names === undefined) return [];
    if (!Array.isArray(names) || !names.every((name) => typeof name === 'string')) {
        throw new Error('Invalid WhatsApp template parameter names');
    }
    return names;
}

/** Empty names explicitly preserve positional templates. Named templates must
 * be configured in the same semantic order as their supplied values. */
export function buildApplicationTemplateComponents(values: string[], names: string[] = []) {
    if (names.length && (names.length !== values.length
        || new Set(names).size !== names.length
        || names.some((name) => !/^[a-z][a-z0-9_]*$/.test(name)))) {
        throw new Error('WhatsApp template parameter names do not match the configured values');
    }
    return [{
        type: 'body',
        parameters: values.map((text, index) => ({
            type: 'text',
            text,
            ...(names.length ? { parameter_name: names[index] } : {}),
        })),
    }];
}
