function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A consumer boundary check, not a general OpenAPI schema validator. */
export function isOpenApiDocument(value: unknown): value is Record<string, unknown> {
    return isRecord(value) && !('ok' in value) &&
        typeof value.openapi === 'string' && /^3\.\d+\.\d+$/.test(value.openapi) &&
        isRecord(value.info) && typeof value.info.title === 'string' &&
        typeof value.info.version === 'string' && isRecord(value.paths) &&
        Object.keys(value.paths).length > 0 &&
        Object.entries(value.paths).every(([route, item]) => route.startsWith('/') && isRecord(item));
}

export async function loadOpenApiDocument(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const response = await fetch('/api/swagger.json', { signal });
    if (!response.ok) throw new Error(`OpenAPI request failed (${response.status})`);
    const value: unknown = await response.json();
    if (!isOpenApiDocument(value)) throw new Error('Invalid OpenAPI document');
    return value;
}
