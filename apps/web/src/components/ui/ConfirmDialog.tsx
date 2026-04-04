'use client';

import { ReactNode } from 'react';

import { Button } from './Button';
import { Dialog } from './Dialog';

type ConfirmDialogProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description?: string;
    message?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: 'primary' | 'danger';
    isLoading?: boolean;
};

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmVariant = 'primary',
    isLoading = false,
}: ConfirmDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={() => {
                if (!isLoading) onClose();
            }}
            title={title}
            description={description}
            size="sm"
            dismissible={!isLoading}
            footer={
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        variant={confirmVariant}
                        onClick={onConfirm}
                        disabled={isLoading}
                        isLoading={isLoading}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            }
        >
            {typeof message === 'string' ? <p className="type-body text-[var(--text-secondary)]">{message}</p> : message}
        </Dialog>
    );
}
