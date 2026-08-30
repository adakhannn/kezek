'use client';

import type { Biz } from '../types';

import { RatingDisplay } from '@/components/RatingDisplay';
import { PublicContactActions } from '@/components/business/PublicContactActions';
import type { ResolvedPublicContacts } from '@/lib/businessContacts';

type BookingHeaderProps = {
    biz: Biz;
    contacts: ResolvedPublicContacts;
    branchName?: string | null;
    t: (key: string, fallback?: string) => string;
};

export function BookingHeader({ biz, contacts, branchName, t }: BookingHeaderProps) {
    return (
        <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="type-page-title text-gray-900 dark:text-gray-100">{biz.name}</h1>
                <RatingDisplay score={biz.rating_score} t={t} variant="badge" className="px-3 py-1" />
            </div>
            {biz.address ? <p className="type-body text-gray-600 dark:text-gray-400">{biz.address}</p> : null}
            {branchName ? (
                <p className="type-caption text-[var(--text-secondary)]">
                    {t('booking.branchContacts', 'Контакты филиала')}: {branchName}
                </p>
            ) : null}
            <PublicContactActions contacts={contacts} compact className="pt-2" />
        </div>
    );
}
