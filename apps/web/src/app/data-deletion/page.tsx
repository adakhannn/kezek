// apps/web/src/app/data-deletion/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Инструкции по удалению данных — Kezek',
    description: 'Инструкции по удалению персональных данных пользователей сервиса Kezek',
};

export default function DataDeletionPage() {
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
                            Инструкции по удалению данных
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Последнее обновление: {new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    <div className="space-y-8">
                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                1. Право на удаление данных
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                В соответствии с законодательством Кыргызской Республики о защите персональных данных, 
                                вы имеете право запросить удаление ваших персональных данных из системы Kezek. 
                                Мы обязуемся выполнить ваш запрос в течение 30 дней с момента его получения.
                            </p>
                            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>Важно:</strong> Удаление данных является необратимым действием. После удаления 
                                    вы не сможете восстановить доступ к вашему аккаунту и истории бронирований.
                                </p>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                2. Какие данные будут удалены
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                При удалении аккаунта будут удалены следующие данные:
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span><strong>Профиль пользователя:</strong> имя, email, номер телефона, настройки аккаунта</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span><strong>История бронирований:</strong> все записи о ваших бронированиях</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span><strong>Отзывы:</strong> все оставленные вами отзывы</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span><strong>Данные аутентификации:</strong> учетные данные для входа в систему</span>
                                </li>
                            </ul>
                            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>Исключения:</strong> Некоторые данные могут быть сохранены в соответствии с требованиями 
                                    законодательства (например, финансовые транзакции для налоговой отчетности) или для защиты 
                                    законных интересов (например, данные о нарушениях правил использования сервиса).
                                </p>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                3. Как запросить удаление данных
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                Для запроса удаления ваших персональных данных выполните следующие шаги:
                            </p>
                            <ol className="space-y-4 text-gray-700 dark:text-gray-300 ml-4">
                                <li className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-semibold">1</span>
                                    <div>
                                        <p className="font-medium mb-1">Войдите в ваш аккаунт</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Перейдите на страницу входа и авторизуйтесь, используя ваш email или номер телефона.
                                        </p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-semibold">2</span>
                                    <div>
                                        <p className="font-medium mb-1">Перейдите в раздел "Профиль"</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            В личном кабинете найдите раздел "Профиль" или "Настройки аккаунта".
                                        </p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-semibold">3</span>
                                    <div>
                                        <p className="font-medium mb-1">Найдите опцию "Удалить аккаунт"</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            В настройках профиля найдите раздел "Опасная зона" или "Удаление аккаунта".
                                        </p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-semibold">4</span>
                                    <div>
                                        <p className="font-medium mb-1">Подтвердите удаление</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Внимательно прочитайте предупреждение и подтвердите удаление аккаунта. 
                                            Вам может потребоваться ввести пароль для подтверждения.
                                        </p>
                                    </div>
                                </li>
                            </ol>
                            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>Альтернативный способ:</strong> Если у вас нет доступа к аккаунту, вы можете 
                                    отправить запрос на удаление данных по email, указав ваше имя, email или номер телефона, 
                                    который был привязан к аккаунту. Мы свяжемся с вами для подтверждения личности.
                                </p>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                4. Сроки обработки запроса
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                После получения вашего запроса на удаление данных:
                            </p>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300 mt-3 ml-4">
                                <li>• Мы подтвердим получение запроса в течение 3 рабочих дней</li>
                                <li>• Удаление данных будет выполнено в течение 30 дней с момента подтверждения</li>
                                <li>• Вы получите уведомление об успешном удалении данных</li>
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                5. Частичное удаление данных
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Если вы хотите удалить только часть ваших данных (например, только историю бронирований 
                                или отзывы), вы можете сделать это через настройки профиля. Некоторые данные можно удалить 
                                самостоятельно, не удаляя весь аккаунт.
                            </p>
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>Доступные опции:</strong>
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 ml-4">
                                    <li>• Удаление отдельных бронирований (если они еще не завершены)</li>
                                    <li>• Удаление или редактирование отзывов</li>
                                    <li>• Изменение или удаление контактных данных</li>
                                </ul>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                6. Восстановление данных
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                После удаления аккаунта восстановление данных невозможно. Если вы передумали, 
                                у вас есть 7 дней с момента запроса на удаление, чтобы отменить его. 
                                После истечения этого срока данные будут безвозвратно удалены.
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                7. Контакты
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                Если у вас возникли вопросы или проблемы с удалением данных, свяжитесь с нами:
                            </p>
                            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>Сервис:</strong> Kezek<br/>
                                    <strong>Веб-сайт:</strong> <a href="https://kezek.kg" className="text-indigo-600 dark:text-indigo-400 hover:underline">kezek.kg</a><br/>
                                    <strong>Email:</strong> Для связи используйте форму обратной связи в Сервисе<br/>
                                    <strong>Связанные документы:</strong> <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">Политика конфиденциальности</Link>
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

