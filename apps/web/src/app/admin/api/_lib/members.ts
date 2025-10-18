export function genTempPassword(len = 12) {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let s = '';
    for (let i = 0; i < len; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
}

export async function trySendSmsKgz(phone: string, text: string) {
    const url = process.env.SMS_API_URL;
    const key = process.env.SMS_API_KEY;
    if (!url || !key) return; // не настроено — молча выходим

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
            body: JSON.stringify({ to: phone, message: text }),
        });
        // игнорируем не-200 — чтобы UI не падал из-за SMS
        void resp.text();
    } catch {
        // гасим ошибки намеренно
    }
}
