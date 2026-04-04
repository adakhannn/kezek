'use client';

import { clsx } from 'clsx';
import { ReactNode, useEffect } from 'react';

type DialogProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    dismissible?: boolean;
    className?: string;
};

const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
};

export function Dialog({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
    dismissible = true,
    className,
}: DialogProps) {
    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && dismissible) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [dismissible, onClose, open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
            onClick={() => {
                if (dismissible) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                aria-describedby={description ? 'dialog-description' : undefined}
                onClick={(event) => event.stopPropagation()}
                className={clsx(
                    'w-full rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)]',
                    sizeStyles[size],
                    className,
                )}
            >
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
                    <div className="min-w-0">
                        <h3 id="dialog-title" className="type-section-title text-[var(--text-primary)]">
                            {title}
                        </h3>
                        {description ? (
                            <p id="dialog-description" className="type-caption mt-1 text-[var(--text-muted)]">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    {dismissible ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="motion-interactive rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                            aria-label="Close dialog"
                        >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    ) : null}
                </div>
                <div className="px-5 py-5">{children}</div>
                {footer ? <div className="border-t border-[var(--border-subtle)] px-5 py-4">{footer}</div> : null}
            </div>
        </div>
    );
}
