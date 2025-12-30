// apps/web/src/app/terms/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Пользовательское соглашение — Kezek',
    description: 'Пользовательское соглашение сервиса Kezek',
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 sm:p-12">
                    <div className="mb-8">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors mb-6"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Вернуться на главную
                        </Link>
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                            Пользовательское соглашение
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Последнее обновление: {new Date().toLocaleDateString('ru-RU', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </p>
                    </div>

                    <div className="space-y-8">
                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                1. Общие положения
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между сервисом Kezek
                                (далее — «Сервис») и пользователем, использующим Сервис для онлайн-бронирования услуг.
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
                                Регистрируясь в Сервисе, оформляя бронирование или продолжая пользоваться Сервисом, пользователь
                                подтверждает, что ознакомился с условиями Соглашения и принимает их в полном объеме.
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                2. Описание Сервиса
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Kezek предоставляет пользователям возможность записываться на услуги к мастерам и в заведения города
                                Ош и других регионов. Сервис выступает как платформа для взаимодействия между клиентами и бизнесами,
                                но не является исполнителем услуг.
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                3. Регистрация и аккаунт
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                Для использования всех возможностей Сервиса пользователь может создать аккаунт с использованием email
                                или других поддерживаемых способов авторизации.
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                <li>Пользователь обязан предоставить достоверные данные при регистрации.</li>
                                <li>Пользователь несёт ответственность за сохранность данных для входа в аккаунт.</li>
                                <li>Все действия, совершённые через аккаунт пользователя, считаются действиями самого пользователя.</li>
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                4. Бронирования и отмены
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                При оформлении бронирования через Сервис пользователь соглашается с правилами конкретного бизнеса
                                (мастера, салона), включая условия отмены или переноса записи.
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                <li>Информация о времени, услуге и мастере отображается в личном кабинете пользователя.</li>
                                <li>Отмена или изменение бронирования возможны только в соответствии с правилами выбранного бизнеса.</li>
                                <li>Сервис не несёт ответственности за качество оказанных услуг — ответственность несёт исполнитель.</li>
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                5. Обязанности пользователя
                            </h2>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                <li>Использовать Сервис только в законных целях.</li>
                                <li>Не предпринимать действий, направленных на нарушение работы Сервиса.</li>
                                <li>Не создавать бронирования с заведомо ложными данными.</li>
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                6. Ограничение ответственности
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Сервис Kezek не является стороной договоров между пользователями и бизнесами и не несёт
                                ответственности за:
                            </p>
                            <ul className="mt-3 space-y-2 text-gray-700 dark:text-gray-300">
                                <li>качество и результат оказанных услуг;</li>
                                <li>отмену или перенос записей со стороны бизнеса или пользователя;</li>
                                <li>любой косвенный ущерб, связанный с использованием Сервиса.</li>
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                7. Обработка персональных данных
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Обработка персональных данных пользователей осуществляется в соответствии с{' '}
                                <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                    Политикой конфиденциальности
                                </Link>
                                .
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                8. Изменения условий Соглашения
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Мы можем обновлять условия настоящего Соглашения. Актуальная версия всегда доступна по адресу{' '}
                                <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">https://kezek.kg/terms</span>.
                                Продолжение использования Сервиса после изменения условий означает согласие с новой версией
                                Соглашения.
                            </p>
                        </section>
                    </div>

                    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200"
                        >
                            Вернуться на главную
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}


