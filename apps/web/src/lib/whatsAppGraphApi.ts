export const DEFAULT_WHATSAPP_GRAPH_API_VERSION = 'v21.0';

export function resolveWhatsAppGraphApiVersion(value?: string | null): string {
    const normalized = value?.trim();
    return normalized && /^v\d+\.\d+$/.test(normalized)
        ? normalized
        : DEFAULT_WHATSAPP_GRAPH_API_VERSION;
}
