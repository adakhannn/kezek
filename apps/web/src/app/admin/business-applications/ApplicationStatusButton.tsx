'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';

export function ApplicationStatusButton({ id, status, label }: { id: string; status: string; label: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    async function update() {
        setLoading(true);
        try {
            const response = await fetch(`/admin/api/business-applications/${id}/status`, {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }),
            });
            if (!response.ok) throw new Error('status update failed');
            router.refresh();
        } finally {
            setLoading(false);
        }
    }
    return <Button type="button" size="sm" variant="outline" onClick={update} isLoading={loading}>{label}</Button>;
}
