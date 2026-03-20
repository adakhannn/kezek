export type Profile = {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    notify_email: boolean;
    notify_whatsapp: boolean;
};

export type ProfileFormState = {
    fullName: string;
    phone: string;
    notifyEmail: boolean;
    notifyWhatsApp: boolean;
};
