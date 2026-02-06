// apps/web/src/lib/notifications/types.ts

export type NotifyType = 'hold' | 'confirm' | 'cancel';

export type RoleKey = 'client' | 'staff' | 'owner' | 'admin';

export interface NotifyRequest {
    type: NotifyType;
    booking_id: string;
}

export interface ServiceRow {
    name_ru: string;
    duration_min: number;
    price_from: number | null;
    price_to: number | null;
}

export interface StaffRow {
    full_name: string;
    email: string | null;
    phone: string | null;
    user_id?: string | null;
}

export interface BizRow {
    name: string;
    email_notify_to: string[] | null;
    slug: string;
    address: string | null;
    phones: string[] | null;
    owner_id?: string | null;
}

export interface BranchRow {
    name: string;
    address: string | null;
}

export interface BookingRow {
    id: string;
    status: string;
    start_at: string; // ISO
    end_at: string;   // ISO
    created_at: string;
    client_id: string | null;
    client_phone: string | null;
    client_name: string | null;
    client_email: string | null;
    services: ServiceRow[] | ServiceRow | null;
    staff: StaffRow[] | StaffRow | null;
    biz: BizRow[] | BizRow | null;
    branches: BranchRow[] | BranchRow | null;
}

export interface ParticipantData {
    email: string | null;
    name: string | null;
    phone: string | null;
    telegramId: number | null;
    notifyEmail: boolean;
    notifyWhatsApp: boolean;
    notifyTelegram: boolean;
    whatsappVerified: boolean;
    telegramVerified: boolean;
}

export interface EmailRecipient {
    email: string;
    name: string | null;
    role: RoleKey;
    withIcs?: boolean;
}

export interface NotificationResult {
    emailsSent: number;
    whatsappSent: number;
    telegramSent: number;
}

// Re-export BookingDetails from messageBuilders
export type { BookingDetails } from './messageBuilders';

