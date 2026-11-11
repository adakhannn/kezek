# Маскирование и ограничения логов

Статус: справочник по исходникам, сверка 2026-11-10. Основное правило — [LOGGING_POLICY](LOGGING_POLICY.md). Маскирование уменьшает раскрытие выбранных данных, но не делает произвольный payload безопасным.

## Общая реализация с разной политикой вывода

| Вход | Реализация | Граница |
| --- | --- | --- |
| @/lib/log, @shared-client/log | [shared log](../../../../packages/shared-client/src/log.ts) → [shared logSafe](../../../../packages/shared-client/src/logSafe.ts) | Основной путь web/mobile; очищает extra, но не scope/message |
| Прямой @/lib/logSafe | [web compatibility helper](logSafe.ts) → shared logger и sanitizer | Сохраняет прежний API и production-вывод info/warn/error; очистка extra теперь общая |

Прямые logSafe/logWarnSafe/logErrorSafe из web helper выводят очищенные данные без общего production-фильтра; только logDebugSafe выключен при NODE_ENV=production. Название Safe не означает одинаковое поведение двух модулей.

## Shared sanitizeObject

- Рекурсивно обрабатывает enumerable-поля и массивы; глубина больше 10 заменяется на [Max depth reached].
- Имена ключей проверяются без учёта регистра по вхождению чувствительных слов. Список включает token, key, secret, password, auth, session, cookie, phone, email, otp, nonce, signature, exchange_code и точный key code.
- Строка в таком поле маскируется частично; чувствительное значение другого ненулевого типа заменяется на [SENSITIVE_DATA_MASKED]. Это может скрыть и полезные поля с похожими именами.
- В свободных строках распознаются Bearer, определённые key=value assignments и JWT-подобные значения. Произвольное имя, телефон или email внутри обычного текста автоматически не распознаются.
- Error с неenumerable message/stack может превратиться в пустой объект. Helper не является полноценным сериализатором исключений.

Для пустой строки/null/undefined maskToken выдаёт [NO_TOKEN], для длины 1–8 — ****, для 9–16 сохраняет первые/последние 2 символа, для более длинных — первые/последние 4. sanitizeObject добавляет длину для длинного чувствительного поля; maskToken — нет. Это частичное раскрытие, а не полное удаление секрета.

Shared maskUrl при успешном разборе URL убирает fragment и обрабатывает query keys/строки; не гарантирует очистку чувствительных значений внутри pathname. При ошибке разбора, в том числе относительного URL без base, возвращается исходная строка после обработки только строковыми шаблонами: fragment и обычные контакты могут остаться. Не передавайте полный URL, если для диагностики достаточно имени операции.

## Совместимость web logSafe

С 10 ноября локальный helper делегирует sanitizeObject, maskToken, maskUrl и вывод shared реализации. Вложенные phone/email/otp/code/nonce/signature и распознаваемые credentials в строках обрабатываются одинаково. В частности, поведение maskUrl при невалидном или относительном URL теперь соответствует shared helper выше. Совместимость уровней вывода и очистка проверяются в [logSafeCompatibility.test.ts](../__tests__/lib/logSafeCompatibility.test.ts).

Утверждение «все логгеры автоматически скрывают телефон, OTP и токены в тексте» по-прежнему неверно: scope/message не очищаются, а свободные строки не распознают все PII. Сохранённая legacy production-политика означает, что очищенный extra у logSafe/logWarnSafe/logErrorSafe выводится и в production; новые вызовы используют основной интерфейс и минимальный набор полей.

## Проверка изменения

Используйте фиктивные строки, похожие по форме на реальные данные, и проверяйте фактический вывод нужного helper в целевом режиме. Проверка должна включать текст сообщения, вложенный объект, URL, Error, массив и ошибку провайдера. Не читайте и не публикуйте production-логи или секреты ради проверки маскирования.

Для PII, хранения копий и служебного доступа — [SECURITY](SECURITY.md), [DATA_RETENTION](../../../../DATA_RETENTION.md), [SERVICE_CLIENT_USAGE_GUIDE](../../../../docs/SERVICE_CLIENT_USAGE_GUIDE.md). Автоматическая очистка Sentry, provider logs и всех прямых console-вызовов этим helper не обеспечивается.
