import {formatInTimeZone} from 'date-fns-tz';
import Link from 'next/link';
import {notFound} from 'next/navigation';

import StaffForm from '../StaffForm';

import DangerActions from "@/app/dashboard/staff/[id]/DangerActions";
import StaffServicesEditor from "@/app/dashboard/staff/[id]/StaffServicesEditor";
import TransferStaffDialog from "@/app/dashboard/staff/[id]/TransferStaffDialog";
import {getBizContextForManagers} from '@/lib/authBiz';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const {supabase, bizId} = await getBizContextForManagers();

    // Грузим сотрудника, список филиалов текущего бизнеса и отзывы
    const [{data: staff, error: eStaff}, {data: branches, error: eBr}, {data: reviewsData}] = await Promise.all([
        supabase
            .from('staff')
            .select('id,full_name,email,phone,branch_id,is_active,biz_id,percent_master,percent_salon,hourly_rate')
            .eq('id', id)
            .maybeSingle(),
        supabase
            .from('branches')
            .select('id,name,is_active')
            .eq('biz_id', bizId)
            .order('name'),
        supabase
            .from('bookings')
            .select(`
                id, start_at, end_at, client_name, client_phone,
                services:services!bookings_service_id_fkey ( name_ru ),
                reviews:reviews ( id, rating, comment, created_at )
            `)
            .eq('staff_id', id)
            .order('start_at', { ascending: false })
            .limit(100),
    ]);

    if (eStaff) {
        return <main className="p-6 text-red-600">Ошибка загрузки сотрудника: {eStaff.message}</main>;
    }
    if (!staff || String(staff.biz_id) !== String(bizId)) {
        return notFound();
    }
    if (eBr) {
        return <main className="p-6 text-red-600">Ошибка загрузки филиалов: {eBr.message}</main>;
    }

    const activeBranches = (branches ?? []).filter(b => b.is_active);
    const currentBranch = (branches ?? []).find(b => b.id === staff.branch_id);
    
    // Обрабатываем отзывы: фильтруем только те, где есть отзыв
    const reviews = (reviewsData ?? [])
        .map(booking => {
            const review = Array.isArray(booking.reviews) ? booking.reviews[0] : booking.reviews;
            if (!review) return null;
            const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
            const serviceName = service && typeof service === 'object' && 'name_ru' in service 
                ? String(service.name_ru) 
                : null;
            return {
                id: review.id,
                rating: review.rating,
                comment: review.comment,
                created_at: review.created_at,
                booking_id: booking.id,
                service_name: serviceName,
                start_at: booking.start_at,
                end_at: booking.end_at,
                client_name: booking.client_name,
                client_phone: booking.client_phone,
            };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

    return (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
            {/* Заголовок с информацией о сотруднике */}
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-lg">
                <div className="px-6 py-6 lg:px-8 lg:py-7">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Link
                                    href="/dashboard/staff"
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    title="Назад к списку сотрудников"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                </Link>
                                <div>
                                    <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">{staff.full_name}</h1>
                                    <div className="flex items-center gap-3 flex-wrap mt-2">
                                        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                                            {staff.is_active ? (
                                                <>
                                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                                    Активен
                                                </>
                                            ) : (
                                                <>
                                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-gray-400" />
                                                    Неактивен
                                                </>
                                            )}
                                        </div>
                                        {currentBranch && (
                                            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                {currentBranch.name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Link
                                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
                                href={`/dashboard/staff/${staff.id}/schedule`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Расписание
                            </Link>
                            <Link
                                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
                                href={`/dashboard/staff/${staff.id}/slots`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Свободные слоты
                            </Link>
                            {activeBranches.length > 1 && (
                                <TransferStaffDialog
                                    staffId={String(staff.id)}
                                    currentBranchId={String(staff.branch_id)}
                                    branches={activeBranches.map(b => ({id: String(b.id), name: String(b.name)}))}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {activeBranches.length === 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 shadow-md">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                            <p className="font-medium mb-1">В этом бизнесе ещё нет активных филиалов</p>
                            <p className="text-gray-600 dark:text-gray-400">Создайте хотя бы один филиал, чтобы назначить сотрудника.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Основная информация */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Основная информация
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Личные данные и контакты сотрудника</p>
                </div>
                <StaffForm
                    initial={{
                        id: String(staff.id),
                        full_name: String(staff.full_name),
                        email: (staff.email ?? null),
                        phone: (staff.phone ?? null),
                        branch_id: String(staff.branch_id),
                        is_active: Boolean(staff.is_active),
                        percent_master: Number(staff.percent_master ?? 60),
                        percent_salon: Number(staff.percent_salon ?? 40),
                        hourly_rate: staff.hourly_rate !== null && staff.hourly_rate !== undefined ? Number(staff.hourly_rate) : null,
                    }}
                    apiBase="/api/staff"
                />
            </div>

            {/* Компетенции */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Компетенции
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Услуги, которые выполняет этот сотрудник</p>
                </div>
                <StaffServicesEditor
                    staffId={String(staff.id)}
                    staffBranchId={String(staff.branch_id)}
                />
            </div>

            {/* Отзывы */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            Отзывы
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Отзывы клиентов о работе сотрудника</p>
                    </div>
                    {reviews.length > 0 && (
                        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5">
                            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{reviews.length}</span>
                            <span className="text-xs text-indigo-600 dark:text-indigo-400">отзывов</span>
                        </div>
                    )}
                </div>
                {reviews.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400">Пока нет отзывов</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => {
                            const dateStr = formatInTimeZone(new Date(review.start_at), TZ, 'dd.MM.yyyy HH:mm');
                            return (
                                <div key={review.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="flex items-center gap-1">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <svg
                                                            key={i}
                                                            className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                    ))}
                                                </div>
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{review.rating}★</span>
                                            </div>
                                            {review.service_name && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                    Услуга: <span className="font-medium">{review.service_name}</span>
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                                {dateStr} • {review.client_name || review.client_phone || 'Клиент'}
                                            </p>
                                        </div>
                                    </div>
                                    {review.comment && (
                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{review.comment}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                    Временные переводы между филиалами задаются в разделе{' '}
                    <Link href={`/dashboard/staff/${staff.id}/schedule`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                        «Расписание»
                    </Link>.
                </p>
            </div>

            <DangerActions staffId={String(staff.id)}/>
        </div>
    );
}
