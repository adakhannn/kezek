// apps/web/src/lib/notifications/types.ts

import type { NotificationLocale } from './notificationText';

export type NotifyType = 'hold' | 'confirm' | 'cancel';

/** Client reminders before the visit: enqueued by enqueue_booking_reminders(), never by POST /api/notify. */
export type ReminderType = 'reminder_24h' | 'reminder_2h';

/** Every booking outbox event type, and so every booking message the planner renders. */
export type BookingEventType = NotifyType | ReminderType;

export function isReminderType(type: BookingEventType): type is ReminderType {
    return type === 'reminder_24h' || type === 'reminder_2h';
}

export type RoleKey = 'client' | 'staff' | 'owner' | 'admin';

export interface NotifyRequest {
    type: NotifyType;
    booking_id: string;
}

export interface ServiceRow {
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
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
    tz?: string | null;
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
    notification_revision?: number;
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
    notificationEmails: string[];
    name: string | null;
    phone: string | null;
    whatsappPhone: string | null;
    telegramId: number | null;
    notifyEmail: boolean;
    notifyWhatsApp: boolean;
    notifyTelegram: boolean;
    whatsappVerified: boolean;
    telegramVerified: boolean;
    /** profiles.preferred_locale of the participant; absent or null means Russian (FE-10). */
    locale?: NotificationLocale | null;
}

export interface EmailRecipient {
    email: string;
    name: string | null;
    role: RoleKey;
    withIcs?: boolean;
    /** Language of this recipient's message; absent means Russian. */
    locale?: NotificationLocale;
}

export interface NotificationResult {
    emailsSent: number;
    whatsappSent: number;
    telegramSent: number;
}

// Re-export BookingDetails from messageBuilders
export type { BookingDetails } from './messageBuilders';

