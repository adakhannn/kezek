'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type Invitation = {
    id: string;
    business_name: string | null;
    branch_name: string | null;
};

type Notice = { kind: 'accepted' } | { kind: 'error'; message: string };

/**
 * Invitations to join a business team (API-06). A manager's invitation links the staff card to this
 * account only when the person accepts it here. Renders nothing while there is nothing to answer.
 */
export default function StaffInvitationsBlock() {
    const { t } = useLanguage();
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/staff-invitations', { cache: 'no-store' });
            const json = await res.json();
            setInvitations(json?.ok && Array.isArray(json?.data?.invitations) ? json.data.invitations : []);
        } catch {
            // The block is optional: a failed load shows nothing rather than an error over the bookings.
            setInvitations([]);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function decide(id: string, action: 'accept' | 'decline') {
        setBusyId(id);
        setNotice(null);
        try {
            const res = await fetch(`/api/staff-invitations/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
            const json = await res.json().catch(() => null);
            if (!json?.ok) {
                setNotice({
                    kind: 'error',
                    message: typeof json?.message === 'string'
                        ? json.message
                        : t('cabinet.staffInvitations.error', 'Не удалось обработать приглашение'),
                });
            } else if (action === 'accept') {
                setNotice({ kind: 'accepted' });
            }
        } catch {
            setNotice({ kind: 'error', message: t('cabinet.staffInvitations.error', 'Не удалось обработать приглашение') });
        } finally {
            setBusyId(null);
            await load();
        }
    }

    if (invitations.length === 0 && !notice) return null;

    return (
        <section
            aria-labelledby="staff-invitations-title"
            className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-lg dark:border-indigo-900 dark:bg-gray-900"
        >
            <h2 id="staff-invitations-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('cabinet.staffInvitations.title', 'Приглашения в команду')}
            </h2>

            {notice?.kind === 'accepted' ? (
                <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-400">
                    {t('cabinet.staffInvitations.accepted', 'Вы в команде. Кабинет сотрудника открыт.')}{' '}
                    <Link href="/staff" className="font-medium underline">
                        {t('cabinet.staffInvitations.openStaffCabinet', 'Открыть кабинет сотрудника')}
                    </Link>
                </p>
            ) : null}
            {notice?.kind === 'error' ? (
                <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{notice.message}</p>
            ) : null}

            {invitations.length > 0 ? (
                <ul className="mt-4 space-y-3">
                    {invitations.map((invitation) => (
                        <li
                            key={invitation.id}
                            className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800"
                        >
                            <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {invitation.business_name ?? t('cabinet.staffInvitations.unknownBusiness', 'Бизнес')}
                                </p>
                                {invitation.branch_name ? (
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {t('cabinet.staffInvitations.branch', 'Филиал: {branch}').replace('{branch}', invitation.branch_name)}
                                    </p>
                                ) : null}
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {t('cabinet.staffInvitations.hint', 'После принятия ваш аккаунт будет связан с карточкой сотрудника этого бизнеса.')}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={busyId !== null}
                                    onClick={() => decide(invitation.id, 'accept')}
                                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {t('cabinet.staffInvitations.accept', 'Принять')}
                                </button>
                                <button
                                    type="button"
                                    disabled={busyId !== null}
                                    onClick={() => decide(invitation.id, 'decline')}
                                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    {t('cabinet.staffInvitations.decline', 'Отклонить')}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : null}
        </section>
    );
}
