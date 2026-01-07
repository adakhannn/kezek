// apps/web/src/app/auth/layout.tsx
import React from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="mx-auto p-6">
            {children}
        </main>
    );
}
