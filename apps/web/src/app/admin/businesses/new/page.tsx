'use client';

import { useState } from 'react';

export default function NewBizPage() {
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [address, setAddress] = useState('');
    const [phones, setPhones] = useState('');           // через запятую
    const [tz, setTz] = useState('Asia/Bishkek');
    const [categories, setCategories] = useState('');   // через запятую
    const [notifyTo, setNotifyTo] = useState('');       // список email, через запятую

    // владелец (необязательно)
    const [ownerEmail, setOwnerEmail] = useState('');
    const [ownerPhone, setOwnerPhone] = useState('');
    const [ownerName, setOwnerName] = useState('');

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true); setErr(null);
        try {
            const payload = {
                name: name.trim(),
                slug: slug.trim(),
                address: address.trim() || null,
                phones: phones.split(',').map(s => s.trim()).filter(Boolean),
                tz: tz.trim(),
                categories: categories.split(',').map(s => s.trim()).filter(Boolean),
                email_notify_to: notifyTo.split(',').map(s => s.trim()).filter(Boolean),
                owner: {
                    email: ownerEmail.trim() || null,
                    phone: ownerPhone.trim() || null,
                    full_name: ownerName.trim() || null,
                },
            };

            const resp = await fetch('/admin/api/businesses/create', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const j = await resp.json();
            if (!resp.ok) throw new Error(j?.error || 'Ошибка создания');

            location.href = `/admin/businesses/${j.id}`;
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="space-y-4">
            <h2 className="text-xl font-semibold">Создать бизнес</h2>
            <form onSubmit={submit} className="space-y-3 max-w-xl">
                <div className="grid gap-2">
                    <input className="border rounded px-3 py-2" placeholder="Название *" value={name} onChange={e=>setName(e.target.value)} required />
                    <input className="border rounded px-3 py-2" placeholder="Slug * (латиница)" value={slug} onChange={e=>setSlug(e.target.value)} required />
                    <input className="border rounded px-3 py-2" placeholder="Адрес" value={address} onChange={e=>setAddress(e.target.value)} />
                    <input className="border rounded px-3 py-2" placeholder="Телефоны (через запятую)" value={phones} onChange={e=>setPhones(e.target.value)} />
                    <input className="border rounded px-3 py-2" placeholder="Часовой пояс" value={tz} onChange={e=>setTz(e.target.value)} />
                    <input className="border rounded px-3 py-2" placeholder="Категории (через запятую)" value={categories} onChange={e=>setCategories(e.target.value)} />
                    <input className="border rounded px-3 py-2" placeholder="E-mail для уведомлений (через запятую)" value={notifyTo} onChange={e=>setNotifyTo(e.target.value)} />
                </div>

                <fieldset className="border rounded p-3 space-y-2">
                    <legend className="px-1 text-sm">Владелец (необязательно)</legend>
                    <input className="border rounded px-3 py-2 w-full" placeholder="Имя владельца" value={ownerName} onChange={e=>setOwnerName(e.target.value)} />
                    <input className="border rounded px-3 py-2 w-full" placeholder="E-mail владельца" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)} />
                    <input className="border rounded px-3 py-2 w-full" placeholder="Телефон владельца (+996…)" value={ownerPhone} onChange={e=>setOwnerPhone(e.target.value)} />
                    <p className="text-xs text-gray-500">Если владелец указан — создадим/найдём пользователя и дадим роль <b>owner</b> этого бизнеса.</p>
                </fieldset>

                {err && <div className="text-red-600 text-sm">{err}</div>}
                <button className="border px-3 py-2 rounded" disabled={loading} type="submit">
                    {loading ? 'Создаём…' : 'Создать'}
                </button>
            </form>
        </main>
    );
}
