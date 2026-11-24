# Переводы мобильного приложения

Статус: текущее руководство. Обновлено 24 ноября 2026. Для тех, кто переводит экраны `apps/mobile`. Источник: код этой папки и [scripts/check-i18n.mjs](../../../../scripts/check-i18n.mjs).

Языки — `ru` (по умолчанию), `ky`, `en`, как на сайте. Переведены все экраны; русский текст вне `t()` остался в нескольких внутренних местах и учтён в [базе](../../../../scripts/i18n-untranslated-baseline.json) под путями `apps/mobile/…`.

## Как добавить текст

1. Ключ — в словарь группы `dictionaries/<группа>.ru.ts`, затем тот же ключ в `<группа>.ky.ts` и `<группа>.en.ts`. Ключи плоские: `группа.экран.имя`, например `'auth.whatsapp.title'`. ky и en объявлены как `Record<keyof typeof <группа>Ru, string>`, поэтому TypeScript не пропустит пропущенный или лишний ключ.
2. В компоненте или хуке:

   ```tsx
   import { useLanguage } from '../../i18n';

   const { t } = useLanguage();
   <Text>{t('auth.whatsapp.title')}</Text>
   <Text>{t('auth.whatsapp.codeSentTo', { phone })}</Text>   // 'Код отправлен на {phone}'
   ```

   `t(key)`, `t(key, params)` или `t(key, 'запасной текст', params)`. `{имя}` заменяется на `params.имя` везде, где встречается, за один проход: значение вставляется как есть, и `{имя}` внутри значения (клиент по имени «{service}») не заменяется. В переводах те же `{параметры}`, что в ru. Ключ типизирован (`MobileI18nKey`), запасной текст нужен только для ключа, которого нет ни в одном словаре, а такого не пропустят ни TypeScript, ни проверка. Нет ключа в выбранном языке — показывается русский.
3. Функция вне компонента получает `t` параметром (`type Translate` из `../../i18n`), как `mapWhatsAppAuthError(error, t)`. Язык этой `t` — `t.locale`; его читают `getErrorMessage` и `translatePlural`, поэтому им не нужен отдельный `locale`. Карта «состояние → текст» хранит ключи (`Record<AuthUiState, MobileI18nKey | null>`), а `t()` вызывается при отрисовке.
4. Текст с числом: три ключа `<ключ>.one`, `<ключ>.few`, `<ключ>.many` с `{count}` в каждом словаре и вызов `translatePlural(t, '<ключ>', count)` из `plural.ts`. Intl не используется: в Hermes его может не быть. Формы: ru — `one` для 1, 21, 101…, `few` для 2–4, 22–24…, `many` для остального; en — `one` только для 1, иначе `many` (`few` повторяет `many`); ky — существительное после числа не меняется, поэтому всегда `one`, и все три текста одинаковы. TypeScript принимает только ключ со всеми тремя формами, а [plural.test.ts](../__tests__/i18n/plural.test.ts) проверяет формы во всех словарях.
5. Новая группа: три файла `<группа>.ru/ky/en.ts` с объектами `<группа>Ru`, `<группа>Ky`, `<группа>En` и подключение в `dictionaries/ru.ts`, `ky.ts`, `en.ts`.
6. Из корня: `node scripts/check-i18n.mjs`. После перевода файла русского текста вне `t()` становится меньше, и проверка просит записать это: `node scripts/check-i18n.mjs --write-baseline`. Рост числа в файле роняет проверку (и CI).

Слова для тех же понятий берутся из словарей сайта (`apps/web/src/app/_components/i18n/dictionaries/*.ky.ts`, `*.en.ts`), чтобы приложение и сайт говорили одинаково. Кыргызский — вежливое «Сиз» (`киргизиңиз`, `тандаңыз`). Русский текст при переводе экрана не меняется, кроме исправления формы слова после числа: на него опираются тесты.

Не переводятся и остаются в базе: сравнение с текстом ответа API (`message.includes('истек')` в `WhatsAppScreen.tsx`) и названия языков в `dictionaries/languageNames.ts` (каждое на своём языке). Общие помощники `lib/errors.ts` (`getErrorMessage`), `utils/validation.ts`, `utils/format.ts` и `lib/signOut.ts` принимают `t` или `locale` последним аргументом; без него остаётся русский текст. `getErrorMessage` показывает текст самой ошибки (ответ сервера на языке приложения или ошибку, брошенную с текстом `t()`), если он не технический и написан письмом языка `t.locale`: кириллицей для ru и ky, в основном латиницей для en (английский текст с кириллическим названием бизнеса подходит, русский с латинским — нет). Иначе показывается текст по статусу или запасной. Кыргызские даты — `i18n/kyDate.ts` (без Intl), названия месяцев и дней — `dictionaries/kyCalendar.ts`.

## Устройство

| Файл | Что делает |
|---|---|
| `index.ts` | Публичный вход: `LanguageProvider`, `useLanguage`, `LanguageSwitcher`, `MobileI18nKey`, `Translate`, `Locale`, `translate`, `translatePlural`, `pluralForm` |
| `LanguageProvider.tsx` | Контекст `{ locale, setLocale, t, ready }`, подключён в `App.tsx` снаружи `ErrorBoundary`, поэтому экран ошибки тоже на выбранном языке. Без провайдера (unit-тесты) `useLanguage()` отдаёт русский. `RootNavigator` ждёт `ready`, чтобы первый экран сразу был на сохранённом языке |
| `locale.ts` | `Locale`, `LOCALES` (порядок KG / RU / EN), язык запросов и `withLocaleHeader()` |
| `localeStorage.ts` | Выбор хранится в `expo-secure-store` под ключом `kezek_locale` на устройстве и переживает выход из аккаунта. `readStoredLocale()` отдаёт `null`, если выбора нет; `loadStoredLocale()` в этом случае отдаёт русский |
| `profileLocaleSync.ts` | `POST /api/profile/locale` с Bearer-токеном: язык уведомлений в `profiles.preferred_locale` |
| `LanguageSwitcher.tsx` | Переключатель KG / RU / EN: экран входа и профиль |
| `plural.ts` | `pluralForm()` и `translatePlural()`: форма текста с числом в ru, ky и en |
| `translate.ts` | `translate()` и `createTranslate()`: поиск ключа и подстановка `{параметров}` за один проход; `t.locale` — язык `t` |
| `dictionaries/` | Словари; проверка русского текста эту папку не сканирует |

## Язык на сервере

- Каждый запрос `lib/api.ts` (`apiRequest`) и `lib/fetchWithTimeout.ts` отправляет заголовок `X-Kezek-Locale: ru|ky|en`. Web API ([serverMessages.ts](../../../web/src/lib/serverMessages.ts)) берёт язык из cookie `kezek_lang`, иначе из этого заголовка, иначе русский, и переводит поля `message`/`error` ответа.
- Язык, выбранный после входа, сразу сохраняется в профиль. После каждого входа (`SIGNED_IN`) язык отправляется в профиль, если на этом устройстве он выбран явно: сохранён в SecureStore или выбран переключателем в этом запуске. Русский по умолчанию, который никто не выбирал, не отправляется. Пара «пользователь — язык» отправляется один раз за запуск, а смена языка это сбрасывает: KG → выход → EN на экране входа → вход снова отправляет язык. Ошибки игнорируются: язык экрана от них не зависит.

Проверки: [LanguageProvider.test.tsx](../__tests__/i18n/LanguageProvider.test.tsx), [plural.test.ts](../__tests__/i18n/plural.test.ts), [CrashScreen.test.tsx](../__tests__/i18n/CrashScreen.test.tsx), [localeHeader.test.ts](../__tests__/i18n/localeHeader.test.ts), [errors.test.ts](../__tests__/lib/errors.test.ts), [AuthScreensKyrgyz.test.tsx](../__tests__/screens/auth/AuthScreensKyrgyz.test.tsx).
