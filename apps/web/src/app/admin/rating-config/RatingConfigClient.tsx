'use client';

import { useState } from 'react';

type RatingConfig = {
    id: string;
    staff_reviews_weight: number;
    staff_productivity_weight: number;
    staff_loyalty_weight: number;
    staff_discipline_weight: number;
    window_days: number;
    is_active: boolean;
    valid_from: string;
    created_at: string;
    updated_at: string;
} | null;

type RatingConfigClientProps = {
    initialConfig: RatingConfig;
};

export function RatingConfigClient({ initialConfig }: RatingConfigClientProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [reviewsWeight, setReviewsWeight] = useState(initialConfig?.staff_reviews_weight ?? 35);
    const [productivityWeight, setProductivityWeight] = useState(initialConfig?.staff_productivity_weight ?? 25);
    const [loyaltyWeight, setLoyaltyWeight] = useState(initialConfig?.staff_loyalty_weight ?? 20);
    const [disciplineWeight, setDisciplineWeight] = useState(initialConfig?.staff_discipline_weight ?? 20);
    const [windowDays, setWindowDays] = useState(initialConfig?.window_days ?? 30);

    const totalWeight = reviewsWeight + productivityWeight + loyaltyWeight + disciplineWeight;
    const isValid = Math.abs(totalWeight - 100) < 0.01 && windowDays >= 1 && windowDays <= 365;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const response = await fetch('/admin/api/rating-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staff_reviews_weight: reviewsWeight,
                    staff_productivity_weight: productivityWeight,
                    staff_loyalty_weight: loyaltyWeight,
                    staff_discipline_weight: disciplineWeight,
                    window_days: windowDays,
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                throw new Error(data.error || 'Ошибка при сохранении настроек');
            }

            setSuccess(true);
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Веса компонентов рейтинга сотрудника
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        Сумма всех весов должна равняться 100%. Эти настройки применяются ко всем бизнесам в системе.
                    </p>

                    {/* Отзывы */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Отзывы клиентов ({reviewsWeight}%)
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={reviewsWeight}
                            onChange={(e) => setReviewsWeight(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-600"
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Влияние средней оценки и количества отзывов на рейтинг
                        </p>
                    </div>

                    {/* Продуктивность */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Продуктивность ({productivityWeight}%)
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={productivityWeight}
                            onChange={(e) => setProductivityWeight(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-600"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Влияние количества клиентов на рейтинг (сравнение со средним по филиалу)
                        </p>
                    </div>

                    {/* Возвращаемость */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Возвращаемость клиентов ({loyaltyWeight}%)
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={loyaltyWeight}
                            onChange={(e) => setLoyaltyWeight(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-600"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Влияние доли клиентов, вернувшихся 2+ раза
                        </p>
                    </div>

                    {/* Дисциплина */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Дисциплина ({disciplineWeight}%)
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={disciplineWeight}
                            onChange={(e) => setDisciplineWeight(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-600"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Влияние опозданий на рейтинг (штраф за каждые 30 минут опоздания)
                        </p>
                    </div>

                    {/* Итоговая сумма */}
                    <div className={`p-4 rounded-lg border ${
                        Math.abs(totalWeight - 100) < 0.01
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Сумма весов:
                            </span>
                            <span className={`text-lg font-bold ${
                                Math.abs(totalWeight - 100) < 0.01
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-red-700 dark:text-red-300'
                            }`}>
                                {totalWeight.toFixed(2)}%
                            </span>
                        </div>
                        {Math.abs(totalWeight - 100) >= 0.01 && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                Сумма должна равняться 100%
                            </p>
                        )}
                    </div>
                </div>

                {/* Период расчета */}
                <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Период расчета рейтинга
                    </h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Количество дней ({windowDays} дней)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="365"
                            value={windowDays}
                            onChange={(e) => setWindowDays(Number(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Скользящее окно для расчета рейтинга (рекомендуется 30 дней)
                        </p>
                    </div>
                </div>

                {/* Сообщения об ошибках и успехе */}
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-sm text-green-700 dark:text-green-300">
                            Настройки успешно сохранены! Страница обновится через несколько секунд...
                        </p>
                    </div>
                )}

                {/* Кнопка сохранения */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <button
                        type="button"
                        onClick={() => {
                            setReviewsWeight(initialConfig?.staff_reviews_weight ?? 35);
                            setProductivityWeight(initialConfig?.staff_productivity_weight ?? 25);
                            setLoyaltyWeight(initialConfig?.staff_loyalty_weight ?? 20);
                            setDisciplineWeight(initialConfig?.staff_discipline_weight ?? 20);
                            setWindowDays(initialConfig?.window_days ?? 30);
                            setError(null);
                            setSuccess(false);
                        }}
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        disabled={loading}
                    >
                        Сбросить
                    </button>
                    <button
                        type="submit"
                        disabled={!isValid || loading}
                        className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                            isValid && !loading
                                ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg'
                                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {loading ? 'Сохранение...' : 'Сохранить настройки'}
                    </button>
                </div>
            </form>
        </section>
    );
}

