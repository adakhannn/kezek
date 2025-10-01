'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function VerifyOtpPage() {
    const params = useSearchParams();
    const phone = params.get('phone') || '';
    const [token, setToken] = useState('');

    async function verify() {
        const { error } = await supabase.auth.verifyOtp({
            phone,
            token,
            type: 'sms',
        });
        if (error) return alert(error.message);
        location.href = '/';
    }

    return (
        <div className="space-y-2">
            <div className="text-sm text-gray-400">На номер <b>{phone}</b> выслан код</div>
            <input className="w-full border rounded px-2 py-1" placeholder="Код из SMS"
                   value={token} onChange={e=>setToken(e.target.value)} />
            <button className="border px-3 py-1 rounded w-full" onClick={verify}>Подтвердить</button>
        </div>
    );
}
