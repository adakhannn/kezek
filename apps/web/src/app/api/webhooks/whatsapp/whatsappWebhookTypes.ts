export type WhatsAppWebhookBody = {
    object?: string;
    entry?: Array<{
        id?: string;
        changes?: Array<{
            field?: string;
            value?: {
                messages?: WhatsAppMessage[];
                statuses?: WhatsAppStatus[];
                [key: string]: unknown;
            };
        }>;
    }>;
};

export type WhatsAppMessage = {
    from: string;
    id: string;
    type: string;
    timestamp: string;
    text?: { body: string };
    image?: { id: string; mime_type?: string; sha256?: string; caption?: string };
    audio?: { id: string; mime_type?: string; sha256?: string };
    video?: { id: string; mime_type?: string; sha256?: string; caption?: string };
    document?: { id: string; filename?: string; mime_type?: string; sha256?: string; caption?: string };
    context?: {
        from?: string;
        id?: string;
    };
    [key: string]: unknown;
};

export type WhatsAppStatus = {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
};

export type ActiveBookingRow = {
    id: string;
    biz_id: string;
    start_at: string;
    services: { name_ru?: string }[] | { name_ru?: string } | null;
    staff: { full_name?: string }[] | { full_name?: string } | null;
    client_id?: string | null;
    client_phone?: string | null;
};
