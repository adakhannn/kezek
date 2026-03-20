import { getBookingStatusMeta } from './bookingCardHelpers';

type BookingCardHeaderProps = {
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    serviceName: string;
    staffName: string;
    businessName: string | null;
    branchName: string | null;
    t: (key: string, fallback?: string) => string;
};

export function BookingCardHeader({
    status,
    serviceName,
    staffName,
    businessName,
    branchName,
    t,
}: BookingCardHeaderProps) {
    const statusMeta = getBookingStatusMeta(status, t);

    return (
        <div className="mb-4 flex items-start justify-between">
            <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.color}`}>
                        <span className={`h-2 w-2 rounded-full ${statusMeta.dotColor}`} />
                        {statusMeta.label}
                    </div>
                </div>
                <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{serviceName}</h3>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {staffName}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {businessName} {branchName && `• ${branchName}`}
                    </span>
                </div>
            </div>
        </div>
    );
}
