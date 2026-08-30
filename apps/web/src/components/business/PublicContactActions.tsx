'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { emailHref, phoneHref, type ResolvedPublicContacts, whatsAppHref } from '@/lib/businessContacts';

type Props = { contacts: ResolvedPublicContacts; compact?: boolean; className?: string };

const baseClass =
    'inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--surface-emphasis)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]';

export function PublicContactActions({ contacts, compact = false, className = '' }: Props) {
    const { locale } = useLanguage();
    const labels = {
        ru: { call: 'Позвонить', email: 'Email', website: 'Сайт', aria: 'Контакты бизнеса' },
        ky: { call: 'Чалуу', email: 'Email', website: 'Сайт', aria: 'Бизнестин байланыштары' },
        en: { call: 'Call', email: 'Email', website: 'Website', aria: 'Business contacts' },
    }[locale] ?? { call: 'Позвонить', email: 'Email', website: 'Сайт', aria: 'Контакты бизнеса' };
    const items = [
        contacts.phone ? { label: compact ? labels.call : contacts.phone, href: phoneHref(contacts.phone), external: false } : null,
        contacts.whatsapp ? { label: 'WhatsApp', href: whatsAppHref(contacts.whatsapp), external: true } : null,
        contacts.email ? { label: compact ? labels.email : contacts.email, href: emailHref(contacts.email), external: false } : null,
        contacts.website ? { label: labels.website, href: contacts.website, external: true } : null,
    ].filter(Boolean) as Array<{ label: string; href: string; external: boolean }>;

    if (items.length === 0) return null;

    return (
        <div className={`flex flex-wrap gap-2 ${className}`} aria-label={labels.aria}>
            {items.map((item) => (
                <a
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    className={baseClass}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noreferrer noopener' : undefined}
                >
                    {item.label}
                </a>
            ))}
        </div>
    );
}
