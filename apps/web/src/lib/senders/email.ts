// apps/web/src/lib/senders/email.ts
import {Resend} from 'resend';

const RESEND_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL = process.env.EMAIL_FROM!;

const resend = new Resend(RESEND_KEY);

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
    await resend.emails.send({from: FROM_EMAIL, to: opts.to, subject, html});
}
