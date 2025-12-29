// apps/web/src/app/cabinet/ClientCabinet.tsx
'use client';

import {useState} from 'react';

import BookingCard from './components/BookingCard';
import ProfileForm from './components/ProfileForm';

type Booking = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    start_at: string;
    end_at: string;
    services?: { name_ru: string; duration_min: number }[] | { name_ru: string; duration_min: number } | null;
    staff?: { full_name: string }[] | { full_name: string } | null;
    branches?: { name: string; lat: number | null; lon: number | null; address: string | null }[] | {
        name: string;
        lat: number | null;
        lon: number | null;
        address: string | null
    } | null;
    businesses?: { name: string; slug: string }[] | { name: string; slug: string } | null;
    reviews?: { id: string; rating: number; comment: string | null }[] | null;
};

function first<T>(v: T | T[] | null | undefined): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default function ClientCabinet({
                                          userId,
                                          upcoming,
                                          past,
                                      }: {
    userId: string;
    upcoming: Booking[];
    past: Booking[];
}) {
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

    return (
        <main className="mx-auto max-w-5xl p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Личный кабинет</h1>
                <div className="flex gap-2">
                    <button
                        className={`border px-3 py-1 rounded ${tab === 'upcoming' ? 'bg-gray-100 font-medium' : ''}`}
                        onClick={() => setTab('upcoming')}
                    >Предстоящие
                    </button>
                    <button
                        className={`border px-3 py-1 rounded ${tab === 'past' ? 'bg-gray-100 font-medium' : ''}`}
                        onClick={() => setTab('past')}
                    >Прошедшие
                    </button>
                </div>
            </div>

            <ProfileForm />

            {tab === 'upcoming' && (
                <section className="space-y-3">
                    {upcoming.length === 0 && <div className="text-gray-500">Предстоящих записей нет</div>}
                    {upcoming.map(b => (
                        <BookingCard
                            key={b.id}
                            bookingId={b.id}
                            status={b.status}
                            start_at={b.start_at}
                            end_at={b.end_at}
                            service={first(b.services)}
                            staff={first(b.staff)}
                            branch={first(b.branches)}
                            business={first(b.businesses)}
                            canCancel
                        />
                    ))}
                </section>
            )}

            {tab === 'past' && (
                <section className="space-y-3">
                    {past.length === 0 && <div className="text-gray-500">Прошедших записей нет</div>}
                    {past.map(b => (
                        <BookingCard
                            key={b.id}
                            bookingId={b.id}
                            status={b.status}
                            start_at={b.start_at}
                            end_at={b.end_at}
                            service={first(b.services)}
                            staff={first(b.staff)}
                            branch={first(b.branches)}
                            business={first(b.businesses)}
                            review={Array.isArray(b.reviews) ? b.reviews[0] : null}
                            canCancel={false}
                        />
                    ))}
                </section>
            )}
        </main>
    );
}
