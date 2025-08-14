'use client';
import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function AuthPanel() {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    async function signIn() {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) alert(error.message);
        else location.reload();
    }
    async function signUp() {
        const { error } = await supabase.auth.signUp({ email, password: pass });
        if (error) alert(error.message);
        else alert('Check email to confirm (if required)');
    }
    async function signOut() { await supabase.auth.signOut(); location.reload(); }
    return (
        <div className="flex items-center gap-2 text-sm">
            <input className="border px-2 py-1 rounded" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" />
            <input className="border px-2 py-1 rounded" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="password" />
            <button className="border px-3 py-1 rounded" onClick={signIn}>Войти</button>
            <button className="border px-3 py-1 rounded" onClick={signUp}>Регистрация</button>
            <button className="border px-3 py-1 rounded" onClick={signOut}>Выйти</button>
        </div>
    );
}