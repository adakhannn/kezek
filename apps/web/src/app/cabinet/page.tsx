// apps/web/src/app/cabinet/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function CabinetPage() {
    // Редирект на страницу записей по умолчанию
    redirect('/cabinet/bookings');
}
