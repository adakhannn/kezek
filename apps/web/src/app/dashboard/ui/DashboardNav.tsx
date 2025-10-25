'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Item({ href, label }: { href: string; label: string }) {
    const pathname = usePathname();
    const active =
        pathname === href ||
        (href !== '/dashboard' && pathname.startsWith(href));

    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`block px-3 py-2 rounded-md text-sm
        ${active ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
        >
            {label}
        </Link>
    );
}

export default function DashboardNav() {
    return (
        <nav className="space-y-1">
            <Item href="/dashboard" label="Главная" />
            <Item href="/dashboard/bookings" label="Брони" />
            <Item href="/dashboard/staff" label="Сотрудники" />
            <Item href="/dashboard/services" label="Услуги" />
            <Item href="/dashboard/branches" label="Филиалы" />
            {/* при необходимости позже добавим «Настройки» */}
        </nav>
    );
}
