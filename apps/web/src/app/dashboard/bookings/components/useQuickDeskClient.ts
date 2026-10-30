'use client';

import { useCallback, useEffect, useState } from 'react';

import { validateName, validatePhone } from '@/lib/validation';

export type QuickDeskClientMode = 'none' | 'existing' | 'new';

export type FoundUser = {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
};

export type QuickDeskClientPayload = {
    clientId: string | null;
    clientName: string | null;
    clientPhone: string | null;
};

export type QuickDeskClientPayloadResult =
    | { ok: true; payload: QuickDeskClientPayload }
    | { ok: false; error: string };

type TranslateFn = (key: string, fallback: string) => string;

async function searchUsersApi(q: string, signal: AbortSignal): Promise<FoundUser[]> {
    const res = await fetch('/api/users/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q }),
        signal,
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'SEARCH_FAILED');
    return j.items ?? [];
}

export function useQuickDeskClient() {
    const [clientMode, setClientMode] = useState<QuickDeskClientMode>('none');
    const [searchQ, setSearchQ] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchErr, setSearchErr] = useState<string | null>(null);
    const [foundUsers, setFoundUsers] = useState<FoundUser[]>([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    const updateSearchQ = useCallback((value: string) => {
        setSearchQ(value);
        setSelectedClientId('');
        setFoundUsers([]);
        setSearchErr(null);
        setSearchLoading(clientMode === 'existing' && !!value.trim());
    }, [clientMode]);

    const updateClientMode = useCallback((mode: QuickDeskClientMode) => {
        setClientMode(mode);
        if (mode !== 'new') {
            setNewClientName('');
            setNewClientPhone('');
        }
        if (mode !== 'existing') {
            setSearchQ('');
            setFoundUsers([]);
            setSelectedClientId('');
            setSearchErr(null);
            setSearchLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!searchQ.trim() || clientMode !== 'existing') {
            return;
        }
        let active = true;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            void searchUsersApi(searchQ, controller.signal).then(items => {
                if (active) setFoundUsers(items);
            }).catch((error: unknown) => {
                if (!active) return;
                setSearchErr(error instanceof Error ? error.message : String(error));
                setFoundUsers([]);
            }).finally(() => {
                if (active) setSearchLoading(false);
            });
        }, 500);
        return () => {
            active = false;
            clearTimeout(timer);
            controller.abort();
        };
    }, [searchQ, clientMode]);

    const getClientPayload = useCallback(
        (t: TranslateFn): QuickDeskClientPayloadResult => {
            if (clientMode === 'none') {
                return { ok: true, payload: { clientId: null, clientName: null, clientPhone: null } };
            }
            if (clientMode === 'existing') {
                if (searchLoading || !foundUsers.some(user => user.id === selectedClientId)) {
                    return {
                        ok: false,
                        error: t('bookings.desk.errors.selectClient', 'Выбери клиента из поиска'),
                    };
                }
                return {
                    ok: true,
                    payload: { clientId: selectedClientId, clientName: null, clientPhone: null },
                };
            }
            const name = newClientName.trim();
            const phone = newClientPhone.trim();
            const nameValidation = validateName(name, true);
            if (!nameValidation.valid) {
                return {
                    ok: false,
                    error: nameValidation.error ?? t('bookings.desk.errors.nameRequired', 'Введите имя клиента'),
                };
            }
            const phoneValidation = validatePhone(phone, true);
            if (!phoneValidation.valid) {
                return {
                    ok: false,
                    error:
                        phoneValidation.error ??
                        t('bookings.desk.errors.phoneRequired', 'Введите корректный номер телефона'),
                };
            }
            return {
                ok: true,
                payload: { clientId: null, clientName: name, clientPhone: phone },
            };
        },
        [clientMode, selectedClientId, foundUsers, searchLoading, newClientName, newClientPhone],
    );

    const canSubmitClient =
        clientMode === 'none' ||
        (clientMode === 'existing' && !searchLoading && foundUsers.some(user => user.id === selectedClientId)) ||
        (clientMode === 'new' && !!newClientName.trim() && !!newClientPhone.trim());

    const reset = useCallback(() => {
        setClientMode('none');
        setSelectedClientId('');
        setSearchQ('');
        setFoundUsers([]);
        setNewClientName('');
        setNewClientPhone('');
        setSearchLoading(false);
        setSearchErr(null);
    }, []);

    return {
        clientMode,
        setClientMode: updateClientMode,
        searchQ,
        setSearchQ: updateSearchQ,
        foundUsers,
        selectedClientId,
        setSelectedClientId,
        newClientName,
        setNewClientName,
        newClientPhone,
        setNewClientPhone,
        searchLoading,
        searchErr,
        getClientPayload,
        canSubmitClient,
        reset,
    };
}
