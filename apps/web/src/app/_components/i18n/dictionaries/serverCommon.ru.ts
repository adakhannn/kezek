// Server messages (FE-10): each value is the exact Russian text a service returns in an API response, or a
// pattern of it with {placeholders}; ky and en translate it. Not part of the client bundle: only
// src/lib/serverMessages.ts imports these, to answer in the language of the request.
export const serverCommonRu = {
    'server.common.staffSelectionRequired': 'Выберите бизнес в кабинете сотрудника',
    'server.common.noStaffAccess': 'Нет доступа к кабинету сотрудника',
    'server.common.accessDenied': 'Доступ запрещен',
    'server.common.dataConflict': 'Конфликт данных',
    'server.common.validationError': 'Ошибка валидации',
    'server.common.notAuthorized': 'Не авторизован',
    'server.common.authUnavailable': 'Сервис авторизации временно недоступен. Повторите позже.',
    'server.common.noBusinessAccess': 'Нет доступа к этому бизнесу',
    'server.common.notFound': 'Ресурс не найден',
    'server.common.internalError': 'Внутренняя ошибка сервера',
    'server.common.rateLimitUnavailable': 'Проверка лимитов временно недоступна. Повторите позже.',
    'server.common.rateLimited': 'Превышен лимит запросов. Попробуйте через {seconds} секунд.',
    'server.common.authRequired': 'Требуется авторизация',
    'server.common.noManagerAccess': 'Нет доступа к кабинету управления',
    'server.common.staffIdMissing': 'Отсутствует ID сотрудника',
    'server.common.staffNotFoundOrForbidden': 'Сотрудник не найден или доступ запрещен',
} as const;
