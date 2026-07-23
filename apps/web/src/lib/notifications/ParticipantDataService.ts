// apps/web/src/lib/notifications/ParticipantDataService.ts

import { type SupabaseClient } from '@supabase/supabase-js';

import type { ParticipantData, BookingRow, StaffRow, BizRow } from './types';

import { logDebug, logError } from '@/lib/log';

export class ParticipantDataService {
    constructor(
        private supabase: SupabaseClient,
        private admin: SupabaseClient
    ) {}

    private async getEnabledNotificationEmails(userId: string): Promise<string[]> {
        const { data, error } = await this.admin
            .from('user_notification_emails')
            .select('email')
            .eq('user_id', userId)
            .eq('verified', true)
            .eq('enabled', true);
        if (error) {
            logError('ParticipantDataService', 'Failed to load notification emails', error);
            return [];
        }
        return Array.from(
            new Set(
                (data ?? [])
                    .map((row) => String(row.email ?? '').trim().toLowerCase())
                    .filter(Boolean),
            ),
        );
    }

    /**
     * Получает данные клиента
     */
    async getClientData(booking: BookingRow): Promise<ParticipantData> {
        const data: ParticipantData = {
            email: null,
            notificationEmails: [],
            name: null,
            phone: null,
            whatsappPhone: null,
            telegramId: null,
            notifyEmail: true,
            notifyWhatsApp: true,
            notifyTelegram: true,
            whatsappVerified: false,
            telegramVerified: false,
        };

        if (booking.client_id) {
            // Получаем данные из auth_users_view
            const { data: au } = await this.supabase
                .from('auth_users_view')
                .select('email, full_name, phone')
                .eq('id', booking.client_id)
                .maybeSingle<{ email: string | null; full_name: string | null; phone: string | null }>();
            
            data.email = au?.email ?? null;
            data.name = au?.full_name ?? null;
            data.phone = au?.phone ?? null;
            
            // Получаем данные из profiles (включая настройки уведомлений)
            try {
                const { data: profile } = await this.supabase
                    .from('profiles')
                    .select('phone, whatsapp_phone, full_name, notify_email, notify_whatsapp, whatsapp_verified, telegram_id, notify_telegram, telegram_verified')
                    .eq('id', booking.client_id)
                    .maybeSingle<{
                        phone: string | null;
                        whatsapp_phone: string | null;
                        full_name: string | null;
                        notify_email: boolean | null;
                        notify_whatsapp: boolean | null;
                        whatsapp_verified: boolean | null;
                        telegram_id: number | null;
                        notify_telegram: boolean | null;
                        telegram_verified: boolean | null;
                    }>();
                
                if (profile) {
                    if (!data.phone && profile.phone) {
                        data.phone = profile.phone;
                        logDebug('ParticipantDataService', 'Got client phone from profiles', { phone: data.phone });
                    }
                    if (!data.name && profile.full_name) {
                        data.name = profile.full_name;
                    }
                    data.notifyEmail = profile.notify_email ?? true;
                    data.notifyWhatsApp = profile.notify_whatsapp ?? true;
                    data.whatsappPhone = profile.whatsapp_phone ?? null;
                    data.whatsappVerified = profile.whatsapp_verified ?? false;
                    data.telegramId = profile.telegram_id ?? null;
                    data.notifyTelegram = profile.notify_telegram ?? true;
                    data.telegramVerified = profile.telegram_verified ?? false;
                }
            } catch (e) {
                logError('ParticipantDataService', 'Failed to get client data from profiles', e);
            }
            data.notificationEmails = await this.getEnabledNotificationEmails(booking.client_id);
            if (data.notificationEmails.length > 0) {
                data.email = data.notificationEmails[0];
            }
        }

        // Fallback для гостевых броней
        if (!data.phone && booking.client_phone) {
            data.phone = booking.client_phone;
        }
        if (!data.email && (booking as { client_email?: string | null }).client_email) {
            data.email = (booking as { client_email: string }).client_email;
        }
        if (!data.name && booking.client_name) {
            data.name = booking.client_name;
        }

        return data;
    }

    /**
     * Получает данные владельца
     */
    async getOwnerData(biz: BizRow | null): Promise<ParticipantData> {
        const data: ParticipantData = {
            email: null,
            notificationEmails: [],
            name: null,
            phone: null,
            whatsappPhone: null,
            telegramId: null,
            notifyEmail: true,
            notifyWhatsApp: true,
            notifyTelegram: true,
            whatsappVerified: false,
            telegramVerified: false,
        };

        if (!biz?.owner_id) {
            return data;
        }

        logDebug('ParticipantDataService', 'Getting owner data', { owner_id: biz.owner_id });

        let ownerEmailFromAuth: string | null = null;

        // Пробуем через Admin API
        try {
            const { data: ou, error: ouError } = await this.admin.auth.admin.getUserById(biz.owner_id);
            if (!ouError && ou?.user) {
                ownerEmailFromAuth = ou.user.email ?? null;
                const meta = (ou.user.user_metadata ?? {}) as Partial<{ full_name: string }>;
                data.name = meta.full_name ?? null;
                data.phone = (ou.user as { phone?: string | null }).phone ?? null;
                logDebug('ParticipantDataService', 'Got owner data via Admin API', { 
                    email: ownerEmailFromAuth, 
                    name: data.name, 
                    phone: data.phone 
                });
            }
        } catch (e) {
            logError('ParticipantDataService', 'Failed to get owner data via Admin API', e);
        }

        // Fallback через auth_users_view
        if (!ownerEmailFromAuth || !data.phone) {
            try {
                const { data: ou } = await this.supabase
                    .from('auth_users_view')
                    .select('email, full_name, phone')
                    .eq('id', biz.owner_id)
                    .maybeSingle<{ email: string | null; full_name: string | null; phone: string | null }>();
                
                if (ou) {
                    ownerEmailFromAuth = ownerEmailFromAuth || (ou.email ?? null);
                    data.name = data.name || (ou.full_name ?? null);
                    data.phone = data.phone || (ou.phone ?? null);
                }
            } catch (e) {
                logError('ParticipantDataService', 'Failed to get owner data via auth_users_view', e);
            }
        }

        // Получаем контактный телефон и WhatsApp из profiles
        if (!data.phone || !data.whatsappPhone) {
            try {
                const { data: profile } = await this.admin
                    .from('profiles')
                    .select('phone, whatsapp_phone')
                    .eq('id', biz.owner_id)
                    .maybeSingle<{ phone: string | null; whatsapp_phone: string | null }>();
                
                if (!data.phone && profile?.phone) {
                    data.phone = profile.phone;
                }
                if (profile?.whatsapp_phone) {
                    data.whatsappPhone = profile.whatsapp_phone;
                }
            } catch (e) {
                logError('ParticipantDataService', 'Failed to get owner phone from profiles', e);
            }
        }

        // Получаем имя и Telegram данные из profiles
        try {
            const { data: profile } = await this.admin
                .from('profiles')
                .select('full_name, notify_email, telegram_id, notify_telegram, telegram_verified')
                .eq('id', biz.owner_id)
                .maybeSingle<{
                    full_name: string | null;
                    notify_email: boolean | null;
                    telegram_id: number | null;
                    notify_telegram: boolean | null;
                    telegram_verified: boolean | null;
                }>();

            if (profile) {
                if (!data.name && profile.full_name) {
                    data.name = profile.full_name;
                }
                data.notifyEmail = profile.notify_email ?? true;
                data.telegramId = profile.telegram_id ?? null;
                data.notifyTelegram = profile.notify_telegram ?? true;
                data.telegramVerified = profile.telegram_verified ?? false;
            }
        } catch (e) {
            logError('ParticipantDataService', 'Failed to get owner notification settings', e);
        }

        data.notificationEmails = await this.getEnabledNotificationEmails(biz.owner_id);
        data.email = data.notificationEmails[0] ?? ownerEmailFromAuth;

        return data;
    }

    /**
     * Получает данные мастера
     */
    async getStaffData(staff: StaffRow | null): Promise<ParticipantData> {
        const data: ParticipantData = {
            email: staff?.email ?? null,
            notificationEmails: [],
            name: staff?.full_name ?? null,
            phone: staff?.phone ?? null,
            whatsappPhone: staff?.phone ?? null,
            telegramId: null,
            notifyEmail: true,
            notifyWhatsApp: true,
            notifyTelegram: true,
            whatsappVerified: false,
            telegramVerified: false,
        };

        // Получаем Telegram/WhatsApp данные мастера (если есть user_id)
        if (staff && 'user_id' in staff && staff.user_id) {
            data.notificationEmails = await this.getEnabledNotificationEmails(staff.user_id);
            data.email = data.notificationEmails[0] ?? data.email;
            try {
                logDebug('ParticipantDataService', 'Getting staff telegram data', { user_id: staff.user_id });
                const { data: profile } = await this.admin
                    .from('profiles')
                    .select('notify_email, whatsapp_phone, whatsapp_verified, notify_whatsapp, telegram_id, notify_telegram, telegram_verified')
                    .eq('id', staff.user_id)
                    .maybeSingle<{ 
                        notify_email: boolean | null;
                        whatsapp_phone: string | null;
                        whatsapp_verified: boolean | null;
                        notify_whatsapp: boolean | null;
                        telegram_id: number | null;
                        notify_telegram: boolean | null;
                        telegram_verified: boolean | null;
                    }>();
                
                if (profile) {
                    data.notifyEmail = profile.notify_email ?? true;
                    data.whatsappPhone = profile.whatsapp_phone ?? data.whatsappPhone;
                    data.whatsappVerified = profile.whatsapp_verified ?? false;
                    data.notifyWhatsApp = profile.notify_whatsapp ?? true;
                    data.telegramId = profile.telegram_id ?? null;
                    data.notifyTelegram = profile.notify_telegram ?? true;
                    data.telegramVerified = profile.telegram_verified ?? false;
                }
            } catch (e) {
                logError('ParticipantDataService', 'Failed to get staff telegram data', e);
            }
        }

        return data;
    }
}

