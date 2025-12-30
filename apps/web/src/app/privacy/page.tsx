// apps/web/src/app/privacy/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Политика конфиденциальности — Kezek',
    description: 'Политика конфиденциальности сервиса Kezek',
};

export default function PrivacyPage() {
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
                            Политика конфиденциальности
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Последнее обновление: {new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    <div className="space-y-8">
                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                1. Общие положения
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных 
                                пользователей сервиса Kezek (далее — «Сервис»). Использование Сервиса означает безоговорочное 
                                согласие пользователя с настоящей Политикой и указанными в ней условиями обработки его персональной информации.
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
                                Сервис Kezek предоставляет платформу для онлайн-бронирования услуг в различных заведениях города Ош. 
                                Мы обязуемся защищать конфиденциальность и безопасность персональных данных наших пользователей.
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                2. Собираемая информация
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                При использовании Сервиса мы можем собирать следующую информацию:
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span><strong>Имя и контактные данные:</strong> телефон, email для связи и идентификации</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span><strong>Информация о бронированиях:</strong> дата, время, услуга, мастер, статус бронирования</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span><strong>Данные для аутентификации:</strong> email, номер телефона для входа в систему</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span><strong>Техническая информация:</strong> IP-адрес, тип браузера, устройство для обеспечения работы Сервиса</span>
                                </li>
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                3. Цели использования информации
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                Собранная информация используется для:
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Обеспечения работы Сервиса и обработки бронирований</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Связи с пользователями по вопросам бронирований</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Отправки уведомлений о бронированиях (email, SMS)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Улучшения качества Сервиса и пользовательского опыта</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Соблюдения требований законодательства Кыргызской Республики</span>
                                </li>
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                4. Защита персональных данных
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Мы применяем современные технические и организационные меры для защиты персональных данных от 
                                несанкционированного доступа, изменения, раскрытия или уничтожения. Данные хранятся на защищенных 
                                серверах с использованием шифрования и других средств защиты.
                            </p>
                            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>Меры безопасности включают:</strong> шифрование данных при передаче (HTTPS), 
                                    ограничение доступа к персональным данным только авторизованным сотрудникам, регулярное 
                                    обновление систем безопасности и мониторинг подозрительной активности.
                                </p>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                5. Передача данных третьим лицам
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Мы не продаем и не передаем персональные данные третьим лицам, за исключением случаев, когда это 
                                необходимо для предоставления услуг (например, отправка SMS через сторонние сервисы) или требуется 
                                по законодательству. В таких случаях мы обеспечиваем конфиденциальность и безопасность данных.
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
                                Мы можем передавать данные следующим категориям получателей:
                            </p>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300 mt-3 ml-4">
                                <li>• Поставщикам услуг (хостинг, SMS-сервисы, email-сервисы) для обеспечения работы Сервиса</li>
                                <li>• Компаниям, предоставляющим услуги аналитики и улучшения качества Сервиса</li>
                                <li>• Государственным органам при наличии законных требований</li>
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                6. Права пользователей
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                Пользователи имеют право:
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Получать информацию о своих персональных данных</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Требовать исправления неточных данных</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Требовать удаления персональных данных (при отсутствии правовых оснований для их хранения)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Отозвать согласие на обработку персональных данных</span>
                                </li>
                            </ul>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4 text-sm">
                                Для реализации своих прав пользователь может обратиться к нам через форму обратной связи или email.
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                7. Cookies и аналогичные технологии
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Сервис использует cookies и аналогичные технологии для обеспечения работы, улучшения пользовательского 
                                опыта и анализа использования Сервиса. Пользователь может настроить браузер для отказа от cookies, 
                                однако это может повлиять на функциональность Сервиса.
                            </p>
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>Типы используемых cookies:</strong>
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 ml-4">
                                    <li>• Необходимые cookies — для работы основных функций Сервиса</li>
                                    <li>• Функциональные cookies — для запоминания ваших предпочтений</li>
                                    <li>• Аналитические cookies — для анализа использования Сервиса</li>
                                </ul>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                8. Изменения в Политике конфиденциальности
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Мы оставляем за собой право вносить изменения в настоящую Политику конфиденциальности. 
                                О существенных изменениях мы уведомим пользователей через Сервис или по email. 
                                Продолжение использования Сервиса после внесения изменений означает согласие с новой версией Политики.
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3 text-sm">
                                Рекомендуем периодически просматривать данную страницу для ознакомления с актуальной версией Политики конфиденциальности.
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                9. Контакты
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                По вопросам, связанным с обработкой персональных данных, вы можете связаться с нами:
                            </p>
                            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>Сервис:</strong> Kezek<br/>
                                    <strong>Веб-сайт:</strong> <a href="https://kezek.kg" className="text-indigo-600 dark:text-indigo-400 hover:underline">kezek.kg</a><br/>
                                    <strong>Email:</strong> Для связи используйте форму обратной связи в Сервисе
                                </p>
                            </div>
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

