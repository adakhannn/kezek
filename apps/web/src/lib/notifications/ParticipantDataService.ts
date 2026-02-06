// apps/web/src/lib/notifications/ParticipantDataService.ts

import { type SupabaseClient } from '@supabase/supabase-js';

import type { ParticipantData, BookingRow, StaffRow, BizRow } from './types';

import { logDebug, logError } from '@/lib/log';

export class ParticipantDataService {
    constructor(
        private supabase: SupabaseClient,
        private admin: SupabaseClient
    ) {}

    /**
     * Получает данные клиента
     */
    async getClientData(booking: BookingRow): Promise<ParticipantData> {
        const data: ParticipantData = {
            email: null,
            name: null,
            phone: null,
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
                    .select('phone, full_name, notify_email, notify_whatsapp, whatsapp_verified, telegram_id, notify_telegram, telegram_verified')
                    .eq('id', booking.client_id)
                    .maybeSingle<{
                        phone: string | null;
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
                    data.whatsappVerified = profile.whatsapp_verified ?? false;
                    data.telegramId = profile.telegram_id ?? null;
                    data.notifyTelegram = profile.notify_telegram ?? true;
                    data.telegramVerified = profile.telegram_verified ?? false;
                }
            } catch (e) {
                logError('ParticipantDataService', 'Failed to get client data from profiles', e);
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
            name: null,
            phone: null,
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

        // Получаем телефон из profiles
        if (!data.phone) {
            try {
                const { data: profile } = await this.admin
                    .from('profiles')
                    .select('phone')
                    .eq('id', biz.owner_id)
                    .maybeSingle<{ phone: string | null }>();
                
                if (profile?.phone) {
                    data.phone = profile.phone;
                }
            } catch (e) {
                logError('ParticipantDataService', 'Failed to get owner phone from profiles', e);
            }
        }

        // Получаем имя и Telegram данные из profiles
        if (!data.name) {
            try {
                const { data: profile } = await this.admin
                    .from('profiles')
                    .select('full_name, telegram_id, notify_telegram, telegram_verified')
                    .eq('id', biz.owner_id)
                    .maybeSingle<{ 
                        full_name: string | null;
                        telegram_id: number | null;
                        notify_telegram: boolean | null;
                        telegram_verified: boolean | null;
                    }>();
                
                if (profile) {
                    if (profile.full_name) {
                        data.name = profile.full_name;
                    }
                    data.telegramId = profile.telegram_id ?? null;
                    data.notifyTelegram = profile.notify_telegram ?? true;
                    data.telegramVerified = profile.telegram_verified ?? false;
                }
            } catch (e) {
                logError('ParticipantDataService', 'Failed to get owner name from profiles', e);
            }
        }

        // Email для уведомлений берется из email_notify_to (приоритет), а не из auth.users
        const adminEmails = biz.email_notify_to ?? [];
        if (adminEmails.length > 0) {
            const normalized = adminEmails
                .filter(Boolean)
                .map((e) => String(e).trim().toLowerCase())
                .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
            
            if (normalized.length > 0) {
                data.email = normalized[0];
                logDebug('ParticipantDataService', 'Using email from email_notify_to', { 
                    email: data.email,
                    emailFromAuth: ownerEmailFromAuth 
                });
            }
        } else {
            // Fallback: используем email из auth.users
            data.email = ownerEmailFromAuth;
            logDebug('ParticipantDataService', 'Using email from auth.users as fallback', { email: data.email });
        }

        return data;
    }

    /**
     * Получает данные мастера
     */
    async getStaffData(staff: StaffRow | null): Promise<ParticipantData> {
        const data: ParticipantData = {
            email: staff?.email ?? null,
            name: staff?.full_name ?? null,
            phone: staff?.phone ?? null,
            telegramId: null,
            notifyEmail: true,
            notifyWhatsApp: true,
            notifyTelegram: true,
            whatsappVerified: false,
            telegramVerified: false,
        };

        // Получаем Telegram данные мастера (если есть user_id)
        if (staff && 'user_id' in staff && staff.user_id) {
            try {
                logDebug('ParticipantDataService', 'Getting staff telegram data', { user_id: staff.user_id });
                const { data: profile } = await this.admin
                    .from('profiles')
                    .select('telegram_id, notify_telegram, telegram_verified')
                    .eq('id', staff.user_id)
                    .maybeSingle<{ 
                        telegram_id: number | null;
                        notify_telegram: boolean | null;
                        telegram_verified: boolean | null;
                    }>();
                
                if (profile) {
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

