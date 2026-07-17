import Link from 'next/link';

import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const cards = [
    {
        href: '/business/owner-apply',
        eyebrow: 'Для владельца',
        title: 'Я владелец существующего бизнеса',
        description: 'Подайте заявку, если бизнес уже есть в Kezek и вы хотите подтвердить владение этим бизнесом.',
        badge: 'Проверяет супер-админ',
    },
    {
        href: '/business/staff-apply',
        eyebrow: 'Для команды',
        title: 'Я сотрудник',
        description: 'Подайте заявку на работу в существующем бизнесе. Владелец проверит её, назначит филиал и активирует рабочий кабинет.',
        badge: 'Проверяет владелец',
    },
];

export default function BusinessRoleApplicationChooserPage() {
    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
            <div className="mb-8 text-center">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                    Доступ к бизнесу
                </p>
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                    Какой доступ вам нужен?
                </h1>
                <p className="mx-auto mt-2 max-w-2xl text-[var(--text-secondary)]">
                    Мы разделили заявки владельцев и сотрудников, чтобы роли не путались и каждая заявка попадала к правильному человеку.
                </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
                {cards.map((card) => (
                    <Link key={card.href} href={card.href} className="group block">
                        <Card
                            variant="elevated"
                            padding="lg"
                            className="h-full transition group-hover:-translate-y-0.5 group-hover:border-indigo-500/60 group-hover:shadow-xl"
                        >
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-primary)]">
                                    {card.eyebrow}
                                </span>
                                <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                                    {card.badge}
                                </span>
                            </div>
                            <h2 className="text-xl font-semibold text-[var(--text-primary)]">{card.title}</h2>
                            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{card.description}</p>
                            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-primary)]">
                                Открыть заявку
                                <span aria-hidden="true">→</span>
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
                Если бизнеса ещё нет в Kezek, используйте страницу{' '}
                <Link href="/business/apply" className="font-semibold text-[var(--accent-primary)]">
                    подключения нового бизнеса
                </Link>.
            </div>
        </main>
    );
}
