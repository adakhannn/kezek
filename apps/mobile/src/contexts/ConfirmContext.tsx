import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import ConfirmDialog from '../components/ui/ConfirmDialog';

type ConfirmOptions = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger';
};

type ConfirmState = ConfirmOptions & {
    visible: boolean;
    resolver: ((value: boolean) => void) | null;
};

type ConfirmContextValue = {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ConfirmState>({
        visible: false,
        title: '',
        message: '',
        confirmLabel: undefined,
        cancelLabel: undefined,
        variant: 'default',
        resolver: null,
    });

    const close = useCallback((value: boolean) => {
        state.resolver?.(value);
        setState((prev) => ({ ...prev, visible: false, resolver: null }));
    }, [state.resolver]);

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setState({
                visible: true,
                resolver: resolve,
                title: options.title,
                message: options.message,
                confirmLabel: options.confirmLabel,
                cancelLabel: options.cancelLabel,
                variant: options.variant ?? 'default',
            });
        });
    }, []);

    const value = useMemo(() => ({ confirm }), [confirm]);

    return (
        <ConfirmContext.Provider value={value}>
            {children}
            <ConfirmDialog
                visible={state.visible}
                title={state.title}
                message={state.message}
                confirmLabel={state.confirmLabel}
                cancelLabel={state.cancelLabel}
                variant={state.variant}
                onCancel={() => close(false)}
                onConfirm={() => close(true)}
            />
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider');
    }
    return context;
}
