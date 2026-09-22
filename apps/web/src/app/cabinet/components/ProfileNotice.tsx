'use client';

import { createPortal } from 'react-dom';

import { AlertBanner } from '@/components/ui/AlertBanner';

type ProfileNoticeProps = {
    message: string | null;
    error: string | null;
    errorTitle: string;
    closeLabel: string;
    onDismissMessage: () => void;
    onDismissError: () => void;
};

export function ProfileNotice({
    message,
    error,
    errorTitle,
    closeLabel,
    onDismissMessage,
    onDismissError,
}: ProfileNoticeProps) {
    if (typeof document === 'undefined' || (!message && !error)) return null;

    return createPortal(
        <div className="pointer-events-none fixed inset-x-3 top-28 z-[110] mx-auto flex max-w-lg flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-32 sm:w-[min(30rem,calc(100vw-2rem))] lg:top-36">
            {message ? (
                <AlertBanner
                    variant="success"
                    appearance="elevated"
                    message={message}
                    className="pointer-events-auto max-h-[40dvh] overflow-y-auto shadow-[var(--shadow-xl)]"
                    onClose={onDismissMessage}
                    closeLabel={closeLabel}
                />
            ) : null}
            {error ? (
                <AlertBanner
                    variant="danger"
                    appearance="elevated"
                    title={errorTitle}
                    message={error}
                    className="pointer-events-auto max-h-[40dvh] overflow-y-auto shadow-[var(--shadow-xl)]"
                    onClose={onDismissError}
                    closeLabel={closeLabel}
                />
            ) : null}
        </div>,
        document.body,
    );
}
