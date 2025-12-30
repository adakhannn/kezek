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
        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Редактирование сотрудника</h1>
                        <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-gray-600 dark:text-gray-400">Управление данными сотрудника</p>
                            {currentBranch && (
                                <>
                                    <span className="text-gray-400 dark:text-gray-500">•</span>
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Филиал: <span className="text-indigo-600 dark:text-indigo-400">{currentBranch.name}</span>
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <Link className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href={`/dashboard/staff/${staff.id}/schedule`}>
                            Расписание
                        </Link>
                        <Link className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200" href={`/dashboard/staff/${staff.id}/slots`}>
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

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
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

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <StaffServicesEditor
                    staffId={String(staff.id)}
                    staffBranchId={String(staff.branch_id)}
                />
            </div>

            {/* Отзывы */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Отзывы</h2>
                    {reviews.length > 0 && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            Всего: {reviews.length}
                        </span>
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
