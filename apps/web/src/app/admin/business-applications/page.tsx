import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

import { ApplicationStatusButton } from './ApplicationStatusButton';

import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

type BusinessRegistrationApplication = {
    id: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    business_name: string | null;
    city: string | null;
    category: string | null;
    comment: string | null;
    status: string | null;
    applicant_user_id: string | null;
    created_at: string;
    created_business_id: string | null;
};

export default async function BusinessApplicationsPage() {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: applications, error } = await admin
        .from('business_registration_applications')
        .select('id,contact_name,phone,email,business_name,city,category,comment,status,applicant_user_id,created_at,created_business_id')
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) return <div className="text-red-600">Ошибка: {error.message}</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Заявки на регистрацию бизнеса</h1>
                <p className="mt-1 text-gray-500">Публичные заявки гостей и авторизованных пользователей.</p>
            </div>

            <div className="grid gap-4">
                {((applications ?? []) as BusinessRegistrationApplication[]).map((application) => (
                    <Card key={application.id} variant="outlined" padding="md" className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">{application.business_name}</h2>
                                <p className="text-sm text-gray-500">
                                    {application.category || 'Категория не указана'} · {application.city || 'Город не указан'}
                                </p>
                            </div>
                            <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1 text-xs font-medium">{application.status}</span>
                        </div>

                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <p><b>Контакт:</b> {application.contact_name}</p>
                            <p><b>Телефон:</b> {application.phone}</p>
                            <p><b>Email:</b> {application.email || '—'}</p>
                            <p><b>Аккаунт:</b> {application.applicant_user_id ? 'авторизован' : 'гость'}</p>
                        </div>

                        {application.comment ? <p className="rounded-lg bg-[var(--surface-emphasis)] p-3 text-sm">{application.comment}</p> : null}

                        <p className="text-xs text-gray-500">{new Date(application.created_at).toLocaleString('ru-RU')}</p>

                        {application.created_business_id ? (
                            <Link
                                href={`/admin/businesses/${application.created_business_id}`}
                                className="inline-flex w-fit items-center rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                            >
                                Открыть созданный бизнес
                            </Link>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                            <ApplicationStatusButton id={application.id} status="contacted" label="Связались" />
                            <ApplicationStatusButton
                                id={application.id}
                                status="approved"
                                label={application.created_business_id ? 'Одобрено' : 'Одобрить и создать бизнес'}
                                disabled={Boolean(application.created_business_id)}
                            />
                            <ApplicationStatusButton id={application.id} status="rejected" label="Отклонить" />
                        </div>
                    </Card>
                ))}

                {!applications?.length ? <Card padding="lg">Заявок пока нет.</Card> : null}
            </div>
        </div>
    );
}
