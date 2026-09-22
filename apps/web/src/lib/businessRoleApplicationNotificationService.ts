import { buildApplicationTemplateComponents, getApplicationNotificationOrigin, getApplicationTemplateParameterNames } from '@/lib/applicationNotificationConfig';
import { getWhatsAppTemplateLanguage, getWhatsAppTemplateName } from '@/lib/env';
import { logError } from '@/lib/log';
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
};

type AdminClient = {
    // Supabase generated types are not stable in this repository yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
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

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
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
            .select('full_name,notify_email,notify_telegram,telegram_id,telegram_verified,notify_whatsapp,whatsapp_phone,whatsapp_verified')
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
    };
}

async function getSuperAdminRecipients(admin: AdminClient) {
    const { data, error } = await admin
        .from('user_roles_with_user')
        .select('user_id')
        .eq('role_key', 'super_admin')
        .is('biz_id', null);
    if (error) {
        logError('ApplicationNotification', 'Could not find super admins', error);
        return [];
    }
    const userIds = [...new Set((data ?? []).map((row: { user_id?: string | null }) => row.user_id).filter(Boolean) as string[])];
    return Promise.all(userIds.map((userId) => getRecipient(admin, userId, {})));
}

async function notifyRecipient(recipient: Recipient, notification: Notification) {
    const deliveries: Array<Promise<unknown>> = [];
    if (recipient.canReceiveEmail) {
        for (const email of recipient.emails) deliveries.push(sendEmail({ ...notification, to: email }));
    }
    if (recipient.canReceiveTelegram && recipient.telegramId) {
        deliveries.push(sendTelegram({ chatId: recipient.telegramId, text: notification.text }));
    }
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

async function notifyRecipients(recipients: Recipient[], notification: Notification) {
    await Promise.all(recipients.map((recipient) => notifyRecipient(recipient, notification)));
}

function applicantNotification(params: { subject: string; text: string; html: string; templateKey: WhatsAppTemplateKey; businessName: string }) {
    return {
        subject: params.subject,
        text: params.text,
        html: params.html,
        whatsApp: { templateKey: params.templateKey, parameters: [params.businessName] },
    } satisfies Notification;
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
        subject: `Kezek: заявка в «${businessName}» отправлена`,
        text: `Ваша заявка сотрудника в «${businessName}» отправлена. Владелец рассмотрит её и сообщит решение. Статус: ${origin}/business/staff-apply`,
        html: `<p>Ваша заявка сотрудника в <b>${escapeHtml(businessName)}</b> отправлена.</p><p>Владелец рассмотрит её и сообщит решение.</p><p><a href="${origin}/business/staff-apply">Открыть статус заявки</a></p>`,
        templateKey: 'staff_applicant',
        businessName,
    }));

    if (!business.owner_id || business.owner_id === application.applicant.id) return;
    const owner = await getRecipient(admin, business.owner_id, {});
    await notifyRecipient(owner, {
        subject: `Kezek: новая заявка сотрудника в «${businessName}»`,
        text: `${application.applicant.name} отправил(а) заявку сотрудника в «${businessName}». Откройте кабинет, чтобы рассмотреть её: ${origin}/dashboard/role-applications`,
        html: `<p><b>${escapeHtml(application.applicant.name)}</b> отправил(а) заявку сотрудника в <b>${escapeHtml(businessName)}</b>.</p><p><a href="${origin}/dashboard/role-applications">Рассмотреть заявку</a></p>`,
        whatsApp: { templateKey: 'staff_owner', parameters: [businessName, application.applicant.name] },
    });
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
        subject: `Kezek: заявка сотрудника в «${businessName}» одобрена`,
        text: `Ваша заявка сотрудника в «${businessName}» одобрена. Рабочий кабинет уже активирован: ${origin}/dashboard`,
        html: `<p>Ваша заявка сотрудника в <b>${escapeHtml(businessName)}</b> одобрена.</p><p>Рабочий кабинет уже активирован.</p><p><a href="${origin}/dashboard">Открыть рабочий кабинет</a></p>`,
        templateKey: 'staff_approved',
        businessName,
    }));
}

/** New-business applications are reviewed by global super admins. */
export async function notifyBusinessApplicationSubmitted(admin: AdminClient, application: SubmittedBusinessApplication) {
    const origin = getApplicationNotificationOrigin();
    const applicant = await getRecipient(admin, application.applicant.id, application.applicant);
    await notifyRecipient(applicant, applicantNotification({
        subject: `Kezek: заявка на подключение «${application.businessName}» отправлена`,
        text: `Ваша заявка на подключение бизнеса «${application.businessName}» отправлена. Мы сообщим решение после проверки. Статус: ${origin}/business/apply`,
        html: `<p>Ваша заявка на подключение бизнеса <b>${escapeHtml(application.businessName)}</b> отправлена.</p><p>Мы сообщим решение после проверки.</p><p><a href="${origin}/business/apply">Открыть статус заявки</a></p>`,
        templateKey: 'business_applicant',
        businessName: application.businessName,
    }));
    await notifyRecipients(await getSuperAdminRecipients(admin), {
        subject: `Kezek: новая заявка на подключение «${application.businessName}»`,
        text: `${application.applicant.name} отправил(а) заявку на подключение бизнеса «${application.businessName}». Рассмотреть: ${origin}/admin/business-applications`,
        html: `<p><b>${escapeHtml(application.applicant.name)}</b> отправил(а) заявку на подключение бизнеса <b>${escapeHtml(application.businessName)}</b>.</p><p><a href="${origin}/admin/business-applications">Рассмотреть заявку</a></p>`,
        whatsApp: { templateKey: 'business_admin', parameters: [application.businessName, application.applicant.name] },
    });
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
        subject: `Kezek: заявка владельца для «${businessName}» отправлена`,
        text: `Ваша заявка на роль владельца для «${businessName}» отправлена. После проверки сообщим решение. Статус: ${origin}/business/owner-apply`,
        html: `<p>Ваша заявка на роль владельца для <b>${escapeHtml(businessName)}</b> отправлена.</p><p>После проверки сообщим решение.</p><p><a href="${origin}/business/owner-apply">Открыть статус заявки</a></p>`,
        templateKey: 'owner_applicant',
        businessName,
    }));
    await notifyRecipients(await getSuperAdminRecipients(admin), {
        subject: `Kezek: новая заявка владельца для «${businessName}»`,
        text: `${application.applicant.name} отправил(а) заявку на роль владельца для «${businessName}». Рассмотреть: ${origin}/admin/role-applications`,
        html: `<p><b>${escapeHtml(application.applicant.name)}</b> отправил(а) заявку на роль владельца для <b>${escapeHtml(businessName)}</b>.</p><p><a href="${origin}/admin/role-applications">Рассмотреть заявку</a></p>`,
        whatsApp: { templateKey: 'owner_admin', parameters: [businessName, application.applicant.name] },
    });
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
        subject: `Kezek: бизнес «${businessName}» подключён`,
        text: `Заявка на подключение «${businessName}» одобрена. Мы создали бизнес и выдали вам доступ владельца. Открыть кабинет: ${origin}/dashboard`,
        html: `<p>Заявка на подключение <b>${escapeHtml(businessName)}</b> одобрена.</p><p>Мы создали бизнес и выдали вам доступ владельца.</p><p><a href="${origin}/dashboard">Открыть кабинет бизнеса</a></p>`,
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
        subject: `Kezek: доступ владельца для «${businessName}» активирован`,
        text: `Ваша заявка на роль владельца для «${businessName}» одобрена. Доступ к кабинету бизнеса уже активирован: ${origin}/dashboard`,
        html: `<p>Ваша заявка на роль владельца для <b>${escapeHtml(businessName)}</b> одобрена.</p><p>Доступ к кабинету бизнеса уже активирован.</p><p><a href="${origin}/dashboard">Открыть кабинет бизнеса</a></p>`,
        templateKey: 'owner_approved',
        businessName,
    }));
}
