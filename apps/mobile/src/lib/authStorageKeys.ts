export const GOOGLE_ACTIVE_FLOW_STORAGE_KEY = 'google_mobile_active_login_v1';
export const TELEGRAM_ACTIVE_FLOW_STORAGE_KEY = 'telegram_mobile_active_login_v1';
export const WHATSAPP_ACTIVE_ATTEMPT_KEY = 'whatsapp_mobile_active_attempt_v1';

export const TRANSIENT_AUTH_STORAGE_KEYS = [
    GOOGLE_ACTIVE_FLOW_STORAGE_KEY,
    TELEGRAM_ACTIVE_FLOW_STORAGE_KEY,
    WHATSAPP_ACTIVE_ATTEMPT_KEY,
] as const;
