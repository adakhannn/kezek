type BookingCardTimelineSectionProps = {
    timelineSteps: Array<{ key: string; done: boolean; label: string }>;
};

export function BookingCardTimelineSection({ timelineSteps }: BookingCardTimelineSectionProps) {
    return (
        <div className="mb-3 flex items-center gap-2">
            {timelineSteps.map((step, index) => (
                <div key={step.key} className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                            step.done
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-gray-300 dark:border-gray-600'
                        }`}
                    >
                        {step.done ? (
                            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l3 3 7-7" />
                            </svg>
                        ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                        )}
                    </div>
                    <span>{step.label}</span>
                    {index < timelineSteps.length - 1 && (
                        <span className="mx-1 h-px w-6 bg-gray-200 dark:bg-gray-700" />
                    )}
                </div>
            ))}
        </div>
    );
}
