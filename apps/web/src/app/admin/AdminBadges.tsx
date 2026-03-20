export function AdminStatusBadge({ status, count }: { status: string; count: number }) {
    const config = {
        hold: {
            label: 'Ожидание',
            color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
        },
        confirmed: {
            label: 'Подтверждено',
            color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700',
        },
        canceled: {
            label: 'Отменено',
            color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700',
        },
    };
    const current =
        config[status as keyof typeof config] || {
            label: status,
            color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700',
        };

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${current.color} text-sm font-medium`}>
            <span>{current.label}</span>
            <span className="font-bold">{count}</span>
        </div>
    );
}

export function AdminBookingStatusBadge({ status }: { status: string }) {
    const config = {
        confirmed: {
            label: 'Подтверждено',
            color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700',
        },
        hold: {
            label: 'Ожидание',
            color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
        },
        canceled: {
            label: 'Отменено',
            color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700',
        },
        paid: {
            label: 'Выполнено',
            color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700',
        },
    };
    const current =
        config[status as keyof typeof config] || {
            label: status,
            color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700',
        };

    return <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${current.color}`}>{current.label}</span>;
}
