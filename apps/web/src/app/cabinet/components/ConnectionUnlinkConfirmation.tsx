'use client';

import { createPortal } from 'react-dom';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function ConnectionUnlinkConfirmation(props: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    isLoading: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) {
    if (!props.open || typeof document === 'undefined') return null;
    return createPortal(
        <div className="fixed inset-0 z-[130]">
            <ConfirmDialog {...props} confirmVariant="danger" />
        </div>, document.body,
    );
}
