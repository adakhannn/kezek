/**
 * ConfirmDialog - модальное окно подтверждения для операторских экранов
 *
 * Использует общий Dialog, чтобы modal-pattern не расходился между workspace-экранами
 */

'use client';

import { clsx } from 'clsx';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
    className?: string;
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    variant = 'info',
    onConfirm,
    onCancel,
    className,
}: ConfirmDialogProps) {
    const confirmVariant = variant === 'danger' ? 'danger' : variant === 'warning' ? 'secondary' : 'primary';

    return (
        <Dialog
            open={isOpen}
            onClose={onCancel}
            title={title}
            description={message}
            size="sm"
            className={clsx('border-[var(--border-subtle)]', className)}
            footer={
                <div className="flex items-center justify-end gap-3">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                    <Button type="button" variant={confirmVariant} onClick={onConfirm}>
                        {confirmLabel}
                    </Button>
                </div>
            }
        >
            <p className="type-body text-[var(--text-secondary)]">{message}</p>
        </Dialog>
    );
}

