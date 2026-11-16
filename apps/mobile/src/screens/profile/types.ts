export type Profile = {
    id: string;
    full_name: string | null;
    phone: string | null;
    notify_email: boolean;
    notify_whatsapp: boolean;
    notify_sms?: boolean | null;
    notify_telegram?: boolean | null;
};
