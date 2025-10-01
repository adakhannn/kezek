'use client';
import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function UpdatePasswordPage() {
    const [pass, setPass] = useState('');

    async function update() {
        const { error } = await supabase.auth.updateUser({ password: pass });
        if (error) return alert(error.message);
        location.href = '/';
    }

    return (
        <div className="space-y-2">
            <input className="w-full border rounded px-2 py-1" placeholder="новый пароль"
                   type="password" value={pass} onChange={e=>setPass(e.target.value)} />
            <button className="border px-3 py-1 rounded w-full" onClick={update}>Сменить пароль</button>
        </div>
    );
}
