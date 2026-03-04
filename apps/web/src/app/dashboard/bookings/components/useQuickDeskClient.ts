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

async function searchUsersApi(q: string): Promise<FoundUser[]> {
    const res = await fetch('/api/users/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q }),
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

    const searchUsers = useCallback(async (q: string) => {
        setSearchLoading(true);
        setSearchErr(null);
        try {
            const items = await searchUsersApi(q);
            setFoundUsers(items);
        } catch (e: unknown) {
            setSearchErr(e instanceof Error ? e.message : String(e));
            setFoundUsers([]);
        } finally {
            setSearchLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!searchQ.trim() || clientMode !== 'existing') {
            setFoundUsers([]);
            return;
        }
        const timer = setTimeout(() => {
            searchUsers(searchQ);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQ, clientMode, searchUsers]);

    useEffect(() => {
        if (clientMode !== 'new') {
            setNewClientName('');
            setNewClientPhone('');
        }
        if (clientMode !== 'existing') {
            setSearchQ('');
            setFoundUsers([]);
            setSelectedClientId('');
        }
    }, [clientMode]);

    const getClientPayload = useCallback(
        (t: TranslateFn): QuickDeskClientPayloadResult => {
            if (clientMode === 'none') {
                return { ok: true, payload: { clientId: null, clientName: null, clientPhone: null } };
            }
            if (clientMode === 'existing') {
                if (!selectedClientId) {
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
        [clientMode, selectedClientId, newClientName, newClientPhone],
    );

    const canSubmitClient =
        clientMode === 'none' ||
        (clientMode === 'existing' && !!selectedClientId) ||
        (clientMode === 'new' && !!newClientName.trim() && !!newClientPhone.trim());

    const reset = useCallback(() => {
        setClientMode('none');
        setSelectedClientId('');
        setSearchQ('');
        setFoundUsers([]);
        setNewClientName('');
        setNewClientPhone('');
    }, []);

    return {
        clientMode,
        setClientMode,
        searchQ,
        setSearchQ,
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
