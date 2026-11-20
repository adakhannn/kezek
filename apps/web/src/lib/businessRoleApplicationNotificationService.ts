import type { SupabaseClient } from '@supabase/supabase-js';

import { buildApplicationTemplateComponents, getApplicationNotificationOrigin, getApplicationTemplateParameterNames } from '@/lib/applicationNotificationConfig';
import { getWhatsAppTemplateLanguage, getWhatsAppTemplateName } from '@/lib/env';
import { escapeHtml } from '@/lib/htmlEscape';
import { logError } from '@/lib/log';
import { notificationLocale, notificationText, type NotificationLocale, type NotificationTextKey } from '@/lib/notifications/notificationText';
import { sendEmail } from '@/lib/senders/email';
import { sendTelegram } from '@/lib/senders/telegram';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

type Recipient = {
    userId: string;
    name: string | null;
    emails: string[];
    telegramId: number | null;
    whatsappPhone: string | null;
    canReceiveEmail: boolean;
    canReceiveTelegram: boolean;
    canReceiveWhatsApp: boolean;
    /** profiles.preferred_locale; NULL or a missing profile means Russian (FE-10). */
    locale: NotificationLocale;
};

type AdminClient = {
    // Supabase generated types are not stable in this repository yet.

    from: SupabaseClient['from'];
    rpc(fn: 'super_admin_user_ids'): PromiseLike<{ data: string[] | null; error: unknown }>;
    auth: {
        admin: {
            getUserById: (userId: string) => Promise<{ data: { user: { email?: string | null } | null }; error: unknown }>;
        };
    };
};

type Applicant = {
    id: string;
    name: string;
    email?: string | null;
};

type SubmittedStaffApplication = {
    id: string | null;
    businessId: string;
    origin?: string;
    applicant: Applicant;
};

type SubmittedBusinessApplication = {
    id: string | null;
    businessName: string;
    origin?: string;
    applicant: Applicant;
};

type WhatsAppTemplateKey = 'staff_owner' | 'staff_applicant' | 'staff_approved' | 'business_applicant' | 'business_admin' | 'business_approved' | 'owner_applicant' | 'owner_admin' | 'owner_approved';

type Notification = {
    subject: string;
    text: string;
    html: string;
    whatsApp?: {
        templateKey: WhatsAppTemplateKey;
        parameters: string[];
    };
};

/** A notification rendered in each recipient's language. */
type LocalizedNotification = (locale: NotificationLocale) => Notification;

type MessageKind = 'staffApplicant' | 'staffOwner' | 'staffApproved' | 'businessApplicant' | 'businessAdmin' | 'businessApproved'
    | 'ownerApplicant' | 'ownerAdmin' | 'ownerApproved' | 'invitation';

type MessageValues = { business: string; origin: string; applicant?: string; branch?: string | null };

/**
 * Subject, text and HTML of `kind` in `locale` (dictionary serverNotifications). The subject and text
 * take the values as they are; the HTML takes them escaped. The ru texts are the pre-FE-10 ones.
 */
function message(kind: MessageKind, locale: NotificationLocale, values: MessageValues): Pick<Notification, 'subject' | 'text' | 'html'> {
    const t = (key: string, params: Record<string, string>) =>
        notificationText(locale, `server.notifications.${key}` as NotificationTextKey, params);
    const plain: Record<string, string> = { business: values.business, origin: values.origin, applicant: values.applicant ?? '' };
    const html: Record<string, string> = { business: escapeHtml(values.business), origin: values.origin, applicant: escapeHtml(values.applicant ?? '') };
    if (kind === 'invitation') {
        plain.branch = values.branch ? t('invitationBranch', { branch: values.branch }) : '';
        html.branch = values.branch ? t('invitationBranchHtml', { branch: escapeHtml(values.branch) }) : '';
    }
    return { subject: t(`${kind}Subject`, plain), text: t(`${kind}Text`, plain), html: t(`${kind}Html`, html) };
}

function uniqueEmails(values: Array<string | null | undefined>) {
    return [...new Set(values
        .map((value) => value?.trim().toLowerCase() ?? '')
        .filter(Boolean))];
}

async function getRecipient(admin: AdminClient, userId: string, fallback: { name?: string | null; email?: string | null }): Promise<Recipient> {
    const [{ data: profile }, { data: notificationEmails }] = await Promise.all([
        admin
            .from('profiles')
            .select('full_name,notify_email,notify_telegram,telegram_id,telegram_verified,notify_whatsapp,whatsapp_phone,whatsapp_verified,preferred_locale')
            .eq('id', userId)
            .maybeSingle(),
        admin
            .from('user_notification_emails')
            .select('email')
            .eq('user_id', userId)
            .eq('verified', true)
            .eq('enabled', true),
    ]);

    const storedEmails = uniqueEmails((notificationEmails ?? []).map((item: { email?: string | null }) => item.email));
    let fallbackEmail = fallback.email ?? null;
    if (!storedEmails.length && !fallbackEmail) {
        const { data } = await admin.auth.admin.getUserById(userId);
        fallbackEmail = data.user?.email ?? null;
    }

    return {
        userId,
        name: profile?.full_name?.trim() || fallback.name?.trim() || null,
        emails: storedEmails.length ? storedEmails : uniqueEmails([fallbackEmail]),
        telegramId: profile?.telegram_id ?? null,
        whatsappPhone: profile?.whatsapp_phone ?? null,
        canReceiveEmail: profile?.notify_email ?? true,
        canReceiveTelegram: Boolean(profile?.notify_telegram && profile?.telegram_verified && profile?.telegram_id),
        canReceiveWhatsApp: Boolean(profile?.notify_whatsapp && profile?.whatsapp_verified && profile?.whatsapp_phone),
        locale: notificationLocale(profile?.preferred_locale),
    };
}

async function getSuperAdminRecipients(admin: AdminClient) {
    // Every store of the platform role (DB-10): user_global_roles, the legacy list and user_roles.
    const { data, error } = await admin.rpc('super_admin_user_ids');
    if (error) {
        logError('ApplicationNotification', 'Could not find super admins', error);
        return [];
    }
    const userIds = [...new Set((data ?? []).filter(Boolean))];
    return Promise.all(userIds.map((userId) => getRecipient(admin, userId, {})));
}

async function notifyRecipient(recipient: Recipient, localized: LocalizedNotification) {
    const notification = localized(recipient.locale);
    const deliveries: Array<Promise<unknown>> = [];
    if (recipient.canReceiveEmail) {
        for (const email of recipient.emails) deliveries.push(sendEmail({ ...notification, to: email }));
    }
    if (recipient.canReceiveTelegram && recipient.telegramId) {
        // sendTelegram uses parse_mode HTML; this text is plain and holds applicant and business names.
        deliveries.push(sendTelegram({ chatId: recipient.telegramId, text: escapeHtml(notification.text) }));
    }
    // WhatsApp goes out as an approved Meta template in its configured language, not as this text.
    const templateName = notification.whatsApp && getWhatsAppTemplateName(notification.whatsApp.templateKey);
    if (recipient.canReceiveWhatsApp && recipient.whatsappPhone && notification.whatsApp && templateName) {
        const whatsApp = notification.whatsApp;
        const phone = recipient.whatsappPhone;
        deliveries.push(Promise.resolve().then(() => sendWhatsApp({
            to: phone,
            text: notification.text,
            template: {
                name: templateName,
                language: getWhatsAppTemplateLanguage(),
                components: buildApplicationTemplateComponents(whatsApp.parameters, getApplicationTemplateParameterNames(whatsApp.templateKey)),
            },
        })));
    }

    const results = await Promise.allSettled(deliveries);
    for (const result of results) {
        if (result.status === 'rejected') {
            const reason = result.reason instanceof Error
                ? result.reason.message
                : typeof result.reason === 'string'
                    ? result.reason
                    : 'Unknown delivery error';
            logError('ApplicationNotification', 'Delivery failed', {
                reason,
                channels: {
                    email: recipient.canReceiveEmail && recipient.emails.length > 0,
                    telegram: recipient.canReceiveTelegram,
                    whatsapp: recipient.canReceiveWhatsApp && Boolean(templateName),
                },
            });
        }
    }
}

async function notifyRecipients(recipients: Recipient[], localized: LocalizedNotification) {
    await Promise.all(recipients.map((recipient) => notifyRecipient(recipient, localized)));
}

function applicantNotification(params: { kind: MessageKind; origin: string; templateKey: WhatsAppTemplateKey; businessName: string }): LocalizedNotification {
    return (locale) => ({
        ...message(params.kind, locale, { business: params.businessName, origin: params.origin }),
        whatsApp: { templateKey: params.templateKey, parameters: [params.businessName] },
    });
}

/** A message to a reviewer (owner or super admin) about the applicant's application. */
function reviewerNotification(params: { kind: MessageKind; origin: string; templateKey: WhatsAppTemplateKey; businessName: string; applicantName: string }): LocalizedNotification {
    return (locale) => ({
        ...message(params.kind, locale, { business: params.businessName, origin: params.origin, applicant: params.applicantName }),
        whatsApp: { templateKey: params.templateKey, parameters: [params.businessName, params.applicantName] },
    });
}

/** Sends non-blocking delivery attempts after a staff application is persisted. */
export async function notifyStaffApplicationSubmitted(admin: AdminClient, application: SubmittedStaffApplication) {
    const { data: business, error } = await admin
        .from('businesses')
        .select('name,owner_id')
        .eq('id', application.businessId)
        .maybeSingle();
    if (error || !business) {
        if (error) logError('ApplicationNotification', 'Business lookup failed', error);
        return;
    }

    const origin = getApplicationNotificationOrigin();
    const businessName = business.name || 'Kezek';
    const applicant = await getRecipient(admin, application.applicant.id, application.applicant);
    await notifyRecipient(applicant, applicantNotification({
        kind: 'staffApplicant',
        origin,
        templateKey: 'staff_applicant',
        businessName,
    }));

    if (!business.owner_id || business.owner_id === application.applicant.id) return;
    const owner = await getRecipient(admin, business.owner_id, {});
    await notifyRecipient(owner, reviewerNotification({
        kind: 'staffOwner',
        origin,
        templateKey: 'staff_owner',
        businessName,
        applicantName: application.applicant.name,
    }));
}

/** Notifies the employee only after their work card and branch assignment exist. */
export async function notifyStaffApplicationApproved(admin: AdminClient, params: { applicantUserId: string; businessId: string; origin?: string }) {
    const { data: business, error } = await admin
        .from('businesses')
        .select('name')
        .eq('id', params.businessId)
        .maybeSingle();
    if (error || !business) {
        if (error) logError('ApplicationNotification', 'Approved staff application business lookup failed', error);
        return;
    }
    const businessName = business.name || 'Kezek';
    const origin = getApplicationNotificationOrigin();
    const applicant = await getRecipient(admin, params.applicantUserId, {});
    await notifyRecipient(applicant, applicantNotification({
        kind: 'staffApproved',
        origin,
        templateKey: 'staff_approved',
        businessName,
    }));
}

/** New-business applications are reviewed by global super admins. */
export async function notifyBusinessApplicationSubmitted(admin: AdminClient, application: SubmittedBusinessApplication) {
    const origin = getApplicationNotificationOrigin();
    const applicant = await getRecipient(admin, application.applicant.id, application.applicant);
    await notifyRecipient(applicant, applicantNotification({
        kind: 'businessApplicant',
        origin,
        templateKey: 'business_applicant',
        businessName: application.businessName,
    }));
    await notifyRecipients(await getSuperAdminRecipients(admin), reviewerNotification({
        kind: 'businessAdmin',
        origin,
        templateKey: 'business_admin',
        businessName: application.businessName,
        applicantName: application.applicant.name,
    }));
}

/** Owner claims are reviewed by global super admins, not by the current owner. */
export async function notifyOwnerApplicationSubmitted(admin: AdminClient, application: SubmittedStaffApplication) {
    const { data: business, error } = await admin
        .from('businesses')
        .select('name')
        .eq('id', application.businessId)
        .maybeSingle();
    if (error || !business) {
        if (error) logError('ApplicationNotification', 'Business lookup failed', error);
        return;
    }
    const origin = getApplicationNotificationOrigin();
    const businessName = business.name || 'Kezek';
    const applicant = await getRecipient(admin, application.applicant.id, application.applicant);
    await notifyRecipient(applicant, applicantNotification({
        kind: 'ownerApplicant',
        origin,
        templateKey: 'owner_applicant',
        businessName,
    }));
    await notifyRecipients(await getSuperAdminRecipients(admin), reviewerNotification({
        kind: 'ownerAdmin',
        origin,
        templateKey: 'owner_admin',
        businessName,
        applicantName: application.applicant.name,
    }));
}

/** Notifies the applicant only after the business and owner role were created successfully. */
export async function notifyBusinessApplicationApproved(admin: AdminClient, params: { applicationId: string; origin?: string }) {
    const { data: application, error } = await admin
        .from('business_registration_applications')
        .select('applicant_user_id,contact_name,email,business_name')
        .eq('id', params.applicationId)
        .maybeSingle();
    if (error || !application?.applicant_user_id) {
        if (error) logError('ApplicationNotification', 'Approved business application lookup failed', error);
        return;
    }
    const businessName = application.business_name || 'Kezek';
    const origin = getApplicationNotificationOrigin();
    const applicant = await getRecipient(admin, application.applicant_user_id, {
        name: application.contact_name,
        email: application.email,
    });
    await notifyRecipient(applicant, applicantNotification({
        kind: 'businessApproved',
        origin,
        templateKey: 'business_approved',
        businessName,
    }));
}

/** Notifies the claimant only after the owner role is granted and linked to the business. */
export async function notifyOwnerApplicationApproved(admin: AdminClient, params: { applicantUserId: string; businessId: string; origin?: string }) {
    const { data: business, error } = await admin
        .from('businesses')
        .select('name')
        .eq('id', params.businessId)
        .maybeSingle();
    if (error || !business) {
        if (error) logError('ApplicationNotification', 'Approved owner application business lookup failed', error);
        return;
    }
    const businessName = business.name || 'Kezek';
    const origin = getApplicationNotificationOrigin();
    const applicant = await getRecipient(admin, params.applicantUserId, {});
    await notifyRecipient(applicant, applicantNotification({
        kind: 'ownerApproved',
        origin,
        templateKey: 'owner_approved',
        businessName,
    }));
}

/**
 * Tells the invited person about a new staff invitation (API-06); they accept or decline it in the
 * client cabinet. E-mail and Telegram only: no approved WhatsApp template exists for invitations.
 */
export async function notifyStaffInvitationCreated(admin: AdminClient, params: { invitedUserId: string; businessName: string; branchName?: string | null }) {
    const businessName = params.businessName || 'Kezek';
    const branchName = params.branchName?.trim() || null;
    const origin = getApplicationNotificationOrigin();
    const invitee = await getRecipient(admin, params.invitedUserId, {});
    await notifyRecipient(invitee, (locale) => message('invitation', locale, { business: businessName, origin, branch: branchName }));
}
