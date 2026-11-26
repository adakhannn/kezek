export type Profile = {
    id: string;
    full_name: string | null;
    phone: string | null;
    notify_email: boolean;
    notify_whatsapp: boolean;
    notify_sms?: boolean | null;
    notify_telegram?: boolean | null;
    /** The WhatsApp number and whether it was confirmed with a code (B5); absent for a new profile. */
    whatsapp_phone?: string | null;
    whatsapp_verified?: boolean | null;
    /** The linked Telegram account (C12). */
    telegram_id?: number | null;
    telegram_username?: string | null;
    telegram_verified?: boolean | null;
    /** Set once Yandex is linked as a sign-in method. */
    yandex_id?: string | number | null;
};
