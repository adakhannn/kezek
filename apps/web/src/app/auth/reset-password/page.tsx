'use client';
import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('');

    async function sendLink() {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/auth/update-password`,
        });
        if (error) return alert(error.message);
        alert('Письмо для восстановления отправлено (если пользователь найден)');
    }

    return (
        <div className="space-y-2">
            <input className="w-full border rounded px-2 py-1" placeholder="email"
                   value={email} onChange={e=>setEmail(e.target.value)} />
            <button className="border px-3 py-1 rounded w-full" onClick={sendLink}>Отправить ссылку</button>
        </div>
    );
}
