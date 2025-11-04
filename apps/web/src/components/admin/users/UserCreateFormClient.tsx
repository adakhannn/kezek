// apps/web/src/components/admin/users/UserCreateFormClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Props = {
    // типизировать Server Action строго можно через experimental types, но здесь оставим попроще
    action: (formData: FormData) => void | Promise<void>;
};

export default function UserCreateFormClient({ action }: Props) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail]       = useState('');
    const [phone, setPhone]       = useState('');
    const [password, setPassword] = useState('');

    // когда есть телефон — скрываем и очищаем пароль
    const phoneProvided = useMemo(() => phone.trim().length > 0, [phone]);

    useEffect(() => {
        if (phoneProvided) {
            setPassword(''); // на всякий случай очищаем
        }
    }, [phoneProvided]);

    return (
        <form className="space-y-4 max-w-xl" action={action}>
            <input
                name="full_name"
                className="border rounded px-3 py-2 w-full"
                placeholder="Имя"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
            />

            <div className="grid md:grid-cols-2 gap-2">
                <input
                    name="email"
                    type="email"
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    name="phone"
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Телефон (+996…)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                />
            </div>

            {/* Пароль показываем только когда email указан И телефона нет */}
            {!phoneProvided && (
                <input
                    name="password"
                    type="password"
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Пароль (обязателен, если указан email)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    // можно ещё disabled={!email.trim()} если хочешь показывать поле, но блокировать без email
                />
            )}

            <ul className="text-xs text-gray-600 space-y-1">
                <li>• Если указан <b>email</b> — нужно задать <b>пароль</b> (минимум 8 символов). Вход: email + пароль.</li>
                <li>• Если указан <b>только телефон</b> — пароль <b>не нужен</b>. Вход по <b>OTP</b>-коду (SMS).</li>
            </ul>

            {/* продублируем фактическую логику подсказкой */}
            <div className="text-xs text-gray-500">
                {phoneProvided
                    ? 'Указан телефон — поле пароля скрыто (для телефона пароль не нужен).'
                    : 'Телефон не указан — для email потребуется пароль.'}
            </div>

            {/* скрытое поле на случай, если password был скрыт — мы уже очистили значение, но пусть будет явно */}
            {phoneProvided && <input type="hidden" name="password" value="" />}

            <button className="border rounded px-3 py-2" type="submit">Создать</button>
        </form>
    );
}
