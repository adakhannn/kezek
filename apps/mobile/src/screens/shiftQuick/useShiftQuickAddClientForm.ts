import { useCallback, useState } from 'react';

import type { ShiftItem } from './types';

type AddClientDraft = Omit<ShiftItem, 'id' | 'createdAt'>;

export function useShiftQuickAddClientForm() {
    const [showAddClient, setShowAddClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newServiceName, setNewServiceName] = useState('');
    const [newServiceAmount, setNewServiceAmount] = useState('');
    const [newConsumablesAmount, setNewConsumablesAmount] = useState('');

    const resetForm = useCallback(() => {
        setShowAddClient(false);
        setNewClientName('');
        setNewServiceName('');
        setNewServiceAmount('');
        setNewConsumablesAmount('');
    }, []);

    const buildDraft = useCallback((): AddClientDraft => {
        return {
            clientName: newClientName.trim(),
            serviceName: newServiceName.trim(),
            serviceAmount: Number(newServiceAmount) || 0,
            consumablesAmount: Number(newConsumablesAmount) || 0,
            bookingId: null,
        };
    }, [newClientName, newServiceName, newServiceAmount, newConsumablesAmount]);

    return {
        showAddClient,
        setShowAddClient,
        newClientName,
        setNewClientName,
        newServiceName,
        setNewServiceName,
        newServiceAmount,
        setNewServiceAmount,
        newConsumablesAmount,
        setNewConsumablesAmount,
        resetForm,
        buildDraft,
    };
}
