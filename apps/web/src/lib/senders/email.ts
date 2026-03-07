// apps/web/src/lib/senders/email.ts
import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResend(): Resend {
    if (!resendClient) {
        const key = process.env.RESEND_API_KEY;
        if (!key) throw new Error('RESEND_API_KEY is not configured');
        resendClient = new Resend(key);
    }
    return resendClient;
}

export async function sendEmailPassword(opts: {
    to: string;
    subject?: string;
    tempPassword: string;
}) {
    const subject = opts.subject ?? 'Временный пароль';
    const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial">
      <p>Здравствуйте!</p>
      <p>Ваш временный пароль: <b>${opts.tempPassword}</b></p>
      <p>Мы рекомендуем сменить пароль после первого входа.</p>
    </div>
  `;
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error('EMAIL_FROM is not configured');
    await getResend().emails.send({ from, to: opts.to, subject, html });
}
