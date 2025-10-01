// apps/web/src/app/auth/layout.tsx
import React from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="mx-auto max-w-md p-6">
            <h1 className="text-2xl font-semibold mb-4">Авторизация</h1>
            <div className="border rounded p-4 bg-white/5">{children}</div>
        </main>
    );
}
