'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import ScheduleCalendar from '@/components/scheduling/ScheduleCalendar';

export default function ExplicitStaffSchedule({ branches }: { branches: { id: string; name: string }[] }) {
    const { t } = useLanguage();
    return (
        <main className="mx-auto max-w-5xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">{t('staff.schedule.title', 'Моё расписание')}</h1>
            <ScheduleCalendar endpoint="/api/staff/me/schedule" branches={branches} />
        </main>
    );
}
