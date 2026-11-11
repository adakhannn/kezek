import type { EmailRecipient, ParticipantData } from './types';
import { normalizeEmails } from './utils';

export function buildEmailRecipients(
        clientData: ParticipantData,
        staffData: ParticipantData,
        ownerData: ParticipantData,
        biz: { email_notify_to: string[] | null } | null
    ): EmailRecipient[] {
        const recipients: EmailRecipient[] = [];

        // Клиент — отдельное письмо с .ics (только если включены email уведомления)
        if (clientData.notifyEmail) {
            const clientEmails = clientData.notificationEmails.length > 0
                ? clientData.notificationEmails
                : clientData.email ? [clientData.email] : [];
            for (const email of clientEmails) {
                recipients.push({
                    email,
                    name: clientData.name,
                    role: 'client',
                    withIcs: true,
                });
            }
        }

        // Мастер
        const staffEmails = staffData.notificationEmails.length > 0
            ? staffData.notificationEmails
            : staffData.email ? [staffData.email] : [];
        if (staffData.notifyEmail) {
            for (const email of staffEmails) {
                recipients.push({
                    email,
                    name: staffData.name,
                    role: 'staff',
                });
            }
        }

        // Владелец
        const ownerEmails = ownerData.notificationEmails.length > 0
            ? ownerData.notificationEmails
            : ownerData.email ? [ownerData.email] : [];
        if (ownerData.notifyEmail) {
            for (const email of ownerEmails) {
                recipients.push({
                    email,
                    name: ownerData.name,
                    role: 'owner',
                });
            }
        }

        // Администраторы из списка
        const adminEmails = biz?.email_notify_to ?? [];
        const normalizedAdminEmails = normalizeEmails(adminEmails);
        const ownerEmailSet = new Set(ownerEmails.map((email) => email.toLowerCase().trim()));
        
        for (const em of normalizedAdminEmails) {
            const emNormalized = em.toLowerCase().trim();
            // Пропускаем email, который уже используется как ownerEmail
            if (ownerEmailSet.has(emNormalized)) {
                continue;
            }
            recipients.push({ email: em, name: null, role: 'admin' });
        }

        // Дедуп по email (оставляем первый встретившийся вариант)
        const uniqMap = new Map<string, EmailRecipient>();
        for (const r of recipients) {
            const normalized = r.email.trim().toLowerCase();
            if (!uniqMap.has(normalized)) {
                uniqMap.set(normalized, { ...r, email: normalized });
            }
        }

        return Array.from(uniqMap.values());
    }

