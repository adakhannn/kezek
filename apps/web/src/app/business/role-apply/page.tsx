import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getServerLocale, getT } from '@/app/_components/i18n/server';
import { Card } from '@/components/ui/Card';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function BusinessRoleApplicationChooserPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/sign-in?redirect=/business/role-apply');
    }

    const t = getT(await getServerLocale());
    const cards = [
        {
            href: '/business/owner-apply',
            eyebrow: t('business.roleApply.owner.eyebrow'),
            title: t('business.roleApply.owner.title'),
            description: t('business.roleApply.owner.description'),
            badge: t('business.roleApply.owner.badge'),
        },
        {
            href: '/business/staff-apply',
            eyebrow: t('business.roleApply.staff.eyebrow'),
            title: t('business.roleApply.staff.title'),
            description: t('business.roleApply.staff.description'),
            badge: t('business.roleApply.staff.badge'),
        },
    ];

    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
            <div className="mb-8 text-center">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                    {t('business.roleApply.eyebrow')}
                </p>
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                    {t('business.roleApply.title')}
                </h1>
                <p className="mx-auto mt-2 max-w-2xl text-[var(--text-secondary)]">
                    {t('business.roleApply.description')}
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
                                {t('business.roleApply.open')}
                                <span aria-hidden="true">→</span>
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
                {t('business.roleApply.newBusiness.prefix')}{' '}
                <Link href="/business/apply" className="font-semibold text-[var(--accent-primary)]">
                    {t('business.roleApply.newBusiness.link')}
                </Link>.
            </div>
        </main>
    );
}
