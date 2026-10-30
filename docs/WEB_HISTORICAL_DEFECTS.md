# WEB: исторические карточки дефектов

204 реальные записи / 203 исходных WB-номера. Это импорт, не новые исправления. Две WB-045 — разные дефекты; объединённая WB-165/166 разделена, шаблон WB-001 исключён. Точный текст каждой карточки со всеми шагами/ожиданием/фактом/ограничениями сохранён в records.jsonl; исходный баг-реестр не переписывался.

## WB-001

Hydration mismatch on direct load of /auth/sign-in

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-001); сохранённый диапазон строк 2417–2452; SHA-256 фрагмента: b73f983985c989e267804e78caf2b4528ab1f565ac81c9de8146d7650ec6167b.
- [Архивный снимок карточки 149](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-002

Public entry pages send failing frontend analytics requests

- Уровень: P2; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-002); сохранённый диапазон строк 2578–2611; SHA-256 фрагмента: 847461f34486da7220958a7b8e7a924d0fd352ddaddc34dad7daab25f3e3f046.
- [Архивный снимок карточки 153](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-003

Legal pages overflow horizontally on a mobile viewport

- Уровень: P2; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-003); сохранённый диапазон строк 2612–2646; SHA-256 фрагмента: 65de28865252291e5381a9f9583566dc3efdbf9ce3f304b5ff54f1223586816c.
- [Архивный снимок карточки 154](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-004

Invalid auth callback routes can hang on an authorization spinner instead of failing explicitly

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-004); сохранённый диапазон строк 2647–2690; SHA-256 фрагмента: 4b94f68b8eff32c9915bafdf574b220ab9ae7696f102a88a2c889c2434bafcb8.
- [Архивный снимок карточки 155](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-005

Invalid Supabase runtime configuration is not surfaced consistently as an explicit safe failure

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-005); сохранённый диапазон строк 2691–2733; SHA-256 фрагмента: ea8c82ec34f77c363309ac7efa80e12138a965ba2806140b6da3a6a9accc3bc8.
- [Архивный снимок карточки 156](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-006

Production CSP blocks Yandex Maps logging requests on /map

- Уровень: P2; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-006); сохранённый диапазон строк 2537–2577; SHA-256 фрагмента: 864b1c17dc6a2d5c523988e546e8c53d03341aa4be1ece6147143ac7ccd729a1.
- [Архивный снимок карточки 152](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-007

Unknown routes use the default Next.js 404 instead of an understandable Kezek recovery UI

- Уровень: P2; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-007); сохранённый диапазон строк 2453–2492; SHA-256 фрагмента: a7c9da23f5befeb4f8de2295450a86051931d1abd3de3c485a15aa379de38e4c.
- [Архивный снимок карточки 150](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-008

/map hides a failed branches request as an empty state and offers no retry action

- Уровень: P2; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-008); сохранённый диапазон строк 2493–2536; SHA-256 фрагмента: 589271fcf55bd749a712e2d60a37937fed93a18b1dfe97a77a26a5c041fe2952.
- [Архивный снимок карточки 151](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-009

Public home cards display normalized rating score as an impossible star rating

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-009); сохранённый диапазон строк 2344–2378; SHA-256 фрагмента: 61d0260afca8bd4309023d02d15fc094e9989a118b4f87fb33e0af32e94d700b.
- [Архивный снимок карточки 147](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-010

Public home booking CTA triggers a 500 funnel-events request

- Уровень: P2; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-010); сохранённый диапазон строк 2379–2416; SHA-256 фрагмента: 37c0e214baeaee30682f3ba02ae5b14479a5527826bf916a711cb827222ac639.
- [Архивный снимок карточки 148](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-011

WhatsApp sign-in exposes missing server service-role configuration in the public UI

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-011); сохранённый диапазон строк 2274–2311; SHA-256 фрагмента: da34e616d7a47dc34f940bef38206b8d21830cd457f996baeb71416fe7665379.
- [Архивный снимок карточки 145](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-012

Google OAuth callback returns a safe failure screen and does not establish an authenticated session locally

- Уровень: P1; состояние: **Исторически open/reopened**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-012); сохранённый диапазон строк 2312–2343; SHA-256 фрагмента: f74c783bbd3fa7a1ff4313b47b9b117c475f6f3018b074af9b541baa07a11d6b.
- [Архивный снимок карточки 146](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-013

Business and booking pages display 0-100 rating scores as impossible star ratings

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-013); сохранённый диапазон строк 2006–2044; SHA-256 фрагмента: e8a3074d1efce820150c36066407e23a90cf5f3da766fe81aa72d0253890a491.
- [Архивный снимок карточки 138](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-014

Booking page emits a hydration mismatch when server and browser timezones differ

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-014); сохранённый диапазон строк 2045–2083; SHA-256 фрагмента: e4b180536447ed72f35132338a815cf3e8c6e1a75bfb1aad6fa0362e9ae237a3.
- [Архивный снимок карточки 139](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-015

Deployed business page still sends analytics to the old admin API path

- Уровень: P2; состояние: **Исторически open/reopened**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-015); сохранённый диапазон строк 2244–2273; SHA-256 фрагмента: 40508a217e5a74bbe85439254dbbaad325d62d3dfa2f26de29cda3fc84f12198.
- [Архивный снимок карточки 144](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-016

Public business page omits active services

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-016); сохранённый диапазон строк 2201–2243; SHA-256 фрагмента: 7526ef0daf83ec3205b4d9f693654fe5ad1a0cfd4976b1498870bda3aa048aa0.
- [Архивный снимок карточки 143](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-017

Marketplace search has no debounced discovery update

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-017); сохранённый диапазон строк 2162–2200; SHA-256 фрагмента: 1e334cf3ca08d47798aba020f7ad9c8ca35212b6ef69b5fcebb36fda3dba8269.
- [Архивный снимок карточки 142](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-018

Marketplace network failure is shown as a normal empty catalog

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-018); сохранённый диапазон строк 2125–2161; SHA-256 фрагмента: b8bb8e6a5c404e0441edb46970e77ee33c0e43b2abd8ce8cf8a47d4fad594675.
- [Архивный снимок карточки 141](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-019

Public map provider failure exposes internal environment configuration details

- Уровень: P2; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-019); сохранённый диапазон строк 2084–2124; SHA-256 фрагмента: ade3a53c082b9589b6deb2e3806c50b38f4f8e88319aa0412f01ba25c5d39689.
- [Архивный снимок карточки 140](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-020

Sign-in return URL handling drops next and accepts unsafe external redirects

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-020); сохранённый диапазон строк 1951–2005; SHA-256 фрагмента: 88ff437953a2322ee67e8c178d304e473e673676ed4217263f9c2629cb28bead.
- [Архивный снимок карточки 137](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-021

Email OTP and password recovery invalid paths expose raw provider errors and weak recovery UI

- Уровень: P1; состояние: **Историческое; вне social-only scope**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-021); сохранённый диапазон строк 1901–1950; SHA-256 фрагмента: 4b15cc3a02a739f53736cdc1676a80dad0e88d8792267fba27637743cdd6e26b.
- [Архивный снимок карточки 136](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-022

Sign-in UI exposes unsupported e-mail magic-link and password-recovery flows

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-022); сохранённый диапазон строк 1864–1900; SHA-256 фрагмента: f8e199580b07e27e00241e1827ca5d0fbedaf2e03492db5c693fc2037a796cf9.
- [Архивный снимок карточки 135](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-023

Google OAuth loses the requested return path and leaves the callback code on the destination URL

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-023); сохранённый диапазон строк 1828–1863; SHA-256 фрагмента: c9e8156aa9eea83a14f77ffcb248dd0254226f44b194bd1ad256a8a21a74bb04.
- [Архивный снимок карточки 134](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-024

Yandex OAuth is rejected because localhost redirect URI does not match the registered Callback URL

- Уровень: P0; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-024); сохранённый диапазон строк 1796–1827; SHA-256 фрагмента: 47903c94a9e5ad9be4a8e6e9631d2febe81e7b43d552ace92ab2790c54c68c68.
- [Архивный снимок карточки 133](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-025

Yandex OAuth callback with sensitive auth fragment remains reachable through browser Back

- Уровень: P0; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-025); сохранённый диапазон строк 1760–1795; SHA-256 фрагмента: d0710d585822a1aeb1a1df1b74eef032c789f1a6797dde8a1ea374fc9873771c.
- [Архивный снимок карточки 132](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-026

OAuth cancellation returns to sign-in without any user feedback

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-026); сохранённый диапазон строк 1733–1759; SHA-256 фрагмента: 18eacd8af0e52f606b1389b908c373f5ae81b8859e591c7d69d091c154cc5a85.
- [Архивный снимок карточки 131](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-027

Real Google OAuth reaches the deployed callback but ends on the authorization error surface

- Уровень: P0; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-027); сохранённый диапазон строк 1700–1732; SHA-256 фрагмента: c05847ad76754cc0399bd042b7bcd2af1f4bdac67c8d6fa84823d3b1f5ac13d8.
- [Архивный снимок карточки 130](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-028

Telegram reminder cannot link an already authenticated account because sign-in immediately redirects away

- Уровень: P0; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-028); сохранённый диапазон строк 1671–1699; SHA-256 фрагмента: ef4239c7fa27d34e70849c327d48d0aa69d176cb757f2c8dad567a71f9213402.
- [Архивный снимок карточки 129](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-029

Telegram linking payload remains in the profile URL fragment when the link request is rate-limited

- Уровень: P0; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-029); сохранённый диапазон строк 1641–1670; SHA-256 фрагмента: 1087f11a443e9fa44438d7c3d643b81e85512cf4c0671999da3ed604d2742ab7.
- [Архивный снимок карточки 128](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-030

Branch creation is blocked when Yandex Maps key is unavailable and owners are denied create access

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-030); сохранённый диапазон строк 1604–1640; SHA-256 фрагмента: b7ea7eefe05dfea1097cdb903f1da803bdda65c965d064cc857d88c86ffa68c3.
- [Архивный снимок карточки 127](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-031

WhatsApp notification connection is implemented but permanently hidden in the profile UI

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-031); сохранённый диапазон строк 1570–1603; SHA-256 фрагмента: ae038ee7e1b6ff0b0c852e6cfe5b5e73ba721d32c3d7202f28e382c57ce26ae7.
- [Архивный снимок карточки 126](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-032

A WhatsApp-verified profile can receive a separate duplicate account on WhatsApp sign-in

- Уровень: P0; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-032); сохранённый диапазон строк 1537–1569; SHA-256 фрагмента: 80f9aa9a7401c1accf04708f55b5a5b344e4fb8755131b5d78e04a949facbbea.
- [Архивный снимок карточки 125](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-033

Social connection screen does not actually support multi-provider account linking and enables unavailable notification channels

- Уровень: P0; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-033); сохранённый диапазон строк 1498–1536; SHA-256 фрагмента: 95276c530dff2693739f49e9fe6b539b4e529c354656e3574cafd211baa45145.
- [Архивный снимок карточки 124](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-034

Contact phone is reused as WhatsApp identity, causing misleading UI and unsafe notification/login ownership

- Уровень: P0; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-034); сохранённый диапазон строк 1455–1497; SHA-256 фрагмента: 685ecb185cd7af5cafaa91ffb8c7be0829bb369e1b76f0ffe57de5afe73a3038.
- [Архивный снимок карточки 123](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-035

WhatsApp linking OTP is accepted by the UI but may not be delivered outside the 24-hour messaging window

- Уровень: P0; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-035); сохранённый диапазон строк 2734–2759; SHA-256 фрагмента: 8f1bc21f50e8d35e2d7e2dd56c55322c3ea5c153cc1d429b29207f27e964bb6f.
- [Архивный снимок карточки 157](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-036

Profile action errors are rendered below all settings and can be missed

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-036); сохранённый диапазон строк 2760–2784; SHA-256 фрагмента: c8fc2e8b13d5361904f668d8e6e352838f566cf6e2f20afebeec63ec62fe688e.
- [Архивный снимок карточки 158](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-037

A WhatsApp number owned by an existing Auth account can be linked to a second Kezek profile

- Уровень: P0; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-037); сохранённый диапазон строк 2785–2812; SHA-256 фрагмента: 3360fc41ddb3b6c597df8a621ec93950c7ad86684c2e49a04dda286b2372bd3e.
- [Архивный снимок карточки 159](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-038

Connected social login methods cannot be unlinked from the profile

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-038); сохранённый диапазон строк 2813–2838; SHA-256 фрагмента: 5aa95567175527ad5e86eca527f7bb4cb23fb7a201db39b361f603e6d2e596ff.
- [Архивный снимок карточки 160](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-039

Legacy Yandex connection is visible in profile but unlink API reports that it is not connected

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-039); сохранённый диапазон строк 2839–2864; SHA-256 фрагмента: 12b1c1f689255600f3c98dcf62091a1080834fa4f98dfd510ae9137d8327d80c.
- [Архивный снимок карточки 161](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-040

Successful Yandex unlink leaves merged Auth metadata and the UI still shows connected

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-040); сохранённый диапазон строк 2865–2890; SHA-256 фрагмента: 0ed467436acb29729c814f2206a3c81642097edacb791f7e28e55fdf712db8a9.
- [Архивный снимок карточки 162](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-041

WhatsApp identity created through a legacy/mobile profile path can still be linked to another account

- Уровень: P0; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-041); сохранённый диапазон строк 2891–2917; SHA-256 фрагмента: 200bc26c09670174ca6af945769f482dbe8df87e94fdfeb7cb7cc1c878cf70fb.
- [Архивный снимок карточки 163](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-042

Users have no self-service account deletion lifecycle

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-042); сохранённый диапазон строк 2918–2942; SHA-256 фрагмента: ab882bcd4bfd0857b270f5f416c4a16437eb21580f264abe716d35d687230573.
- [Архивный снимок карточки 164](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-043

Business owners can create an unlimited number of branches

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-043); сохранённый диапазон строк 2943–2968; SHA-256 фрагмента: 3b0194bd9dd0743166d0584d444863b163d7907601ee9e3a8bfb02c12c1120d0.
- [Архивный снимок карточки 165](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-044

Guests and non-owner users cannot submit a business registration application

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-044); сохранённый диапазон строк 2969–2992; SHA-256 фрагмента: df9d8ce15dc0f122bbea47b1ceb3f0620a428678c26fc111c8df018ef17f4991.
- [Архивный снимок карточки 166](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-045@admin-access

Admin business applications page is accessible to a user without any admin/global/business roles

- Уровень: P0; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-045); сохранённый диапазон строк 1412–1454; SHA-256 фрагмента: 44f71438c29419d3267df88bc8785fc28cccf921abbb634f02b238334158daf5.
- [Архивный снимок карточки 122](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-045@public-links

Registration directory links are not copied to the first created branch

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-045); сохранённый диапазон строк 2993–3025; SHA-256 фрагмента: 1f1e5fd73d92d8861271b4fd38ac5cd3e5fc6c6647248ba5305f22bf16ba8e2b.
- [Архивный снимок карточки 167](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-046

Approving a business registration application does not create a business

- Уровень: P0; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-046); сохранённый диапазон строк 1355–1411; SHA-256 фрагмента: 0fe4722c4d951efbc141643a134da03902c4894a08f042ae0e2308b19c9e2efc.
- [Архивный снимок карточки 121](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-047

Admin business members page remains stuck loading and throws a React hydration error

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-047); сохранённый диапазон строк 1320–1354; SHA-256 фрагмента: 6e026c2805639ad510833a0a205433d652e41a4b71113718fd54832df576bf35.
- [Архивный снимок карточки 120](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-048

Public business page emits a React hydration error in production

- Уровень: P1; состояние: **Исторически open/reopened**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-048); сохранённый диапазон строк 3026–3045; SHA-256 фрагмента: 721ab494fdb15c779ffad7dc03cc6c957ab9214cd06be3490e5c6f8e76ce24c3.
- [Архивный снимок карточки 168](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-049

Production branch map cannot initialize because the Yandex Maps API key is missing

- Уровень: P1; состояние: **Исторически open/reopened**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-049); сохранённый диапазон строк 3076–3095; SHA-256 фрагмента: 6d04c406da357cee0516e9b050079f495b618b5369da7065cac20ab11f6a00dd.
- [Архивный снимок карточки 170](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-050

Approving a business application fails with an unhandled duplicate-owner database error

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-050); сохранённый диапазон строк 3046–3075; SHA-256 фрагмента: 6c2494a0b4881ce9a317d4b4befc7f32039d647274ea097bf7e528155fad6fc6.
- [Архивный снимок карточки 169](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-051

Owner workspace has no business selector after enabling multiple businesses

- Уровень: P1; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-051); сохранённый диапазон строк 3096–3131; SHA-256 фрагмента: 1d8465cb2a460780a83001ec0f7b8d69c4427c5d94ef1a52638d080f0bb86fc3.
- [Архивный снимок карточки 171](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-052

Desktop owner workspace sidebar cannot be collapsed

- Уровень: P2; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-052); сохранённый диапазон строк 3132–3163; SHA-256 фрагмента: d639dff725ed55846e0dbfba76e7bb5cab2c1b7cc7c151c4dde1161be54bc58f.
- [Архивный снимок карточки 172](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-053

Approving a staff application grants a role but does not create a usable staff record

- Уровень: P0; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-053); сохранённый диапазон строк 3164–3211; SHA-256 фрагмента: 8e40810a58a8687bc15cfe18115a20e301bd76e5fb88d937d997186442dac0ba.
- [Архивный снимок карточки 173](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-054

Staff context assumes one active staff record per user across the whole platform

- Уровень: P1; состояние: **Исторически open/reopened**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-054); сохранённый диапазон строк 3212–3233; SHA-256 фрагмента: 0e5fc9e205aa527c8aa3fd5055a0b7e20484d3003deaf6aae18fc6e67855d1fb.
- [Архивный снимок карточки 174](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-055

Shared logo emits a Next/Image aspect-ratio warning

- Уровень: P2; состояние: **Исторически open/reopened**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-055); сохранённый диапазон строк 3234–3260; SHA-256 фрагмента: d25a357c8a75d9c2235b521dd6234a2867dcda34d095327ad6824e4dfb92fd91.
- [Архивный снимок карточки 175](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-056

Staff list shows a generic business-name fallback instead of the active business name

- Уровень: P2; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-056); сохранённый диапазон строк 3261–3304; SHA-256 фрагмента: 8176bb04d9d352e8d535119a64f63b744731bdeeb413d3129a40eabbdb0f2428.
- [Архивный снимок карточки 176](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-057

Owner application page logs a JSON parse error while loading the applicant's pending applications

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-057); сохранённый диапазон строк 3305–3333; SHA-256 фрагмента: 529efe8b0a0b1e790f5fd763231a0355792a46235c56f8cfd8bd745d4c1f9f42.
- [Архивный снимок карточки 177](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-058

Native category select is vertically misaligned with adjacent inputs

- Уровень: P2; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-058); сохранённый диапазон строк 3334–3365; SHA-256 фрагмента: 86b0f36e701984937ee65c25f2a15b7ba2b2e8854f7ad65ec85e27f3236b29c2.
- [Архивный снимок карточки 178](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-059

Business application page remains Russian after switching the site language

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-059); сохранённый диапазон строк 3366–3403; SHA-256 фрагмента: 6a7bc08d7b1d2cd703844526cbaf97afb89ca2b66ccc03941ed991e7d338a94b.
- [Архивный снимок карточки 179](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-060

Business entry links in the footer stay Russian in Kyrgyz and English locales

- Уровень: P2; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-060); сохранённый диапазон строк 3404–3434; SHA-256 фрагмента: 51a844124610a27f1dea890766969f5d80ec24702568b0ca2ac3e71502f16f87.
- [Архивный снимок карточки 180](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-061

Authenticated business application page crashes when the local service-role key is absent

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-061); сохранённый диапазон строк 3435–3475; SHA-256 фрагмента: eb75b215f59f95c492295e8b27dbe17c481bb6fb15b89a57a220cf54a3d27019.
- [Архивный снимок карточки 181](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-062

Business application does not prefill the phone stored in the user's account

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-062); сохранённый диапазон строк 3476–3512; SHA-256 фрагмента: 8e9e9ec12100a00e149fc2ce4e0592e1595e8197d0cf7db8af9b8265ac1b6714.
- [Архивный снимок карточки 182](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-063

Missing local service configuration is shown as a generic application failure

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-063); сохранённый диапазон строк 3513–3549; SHA-256 фрагмента: 952a1b6fa8a80383718b61cadc4b5652b8182d1c44ee5b4ac297754ff3c06d40.
- [Архивный снимок карточки 183](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-064

Rejected business applications continue to show moderation actions

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-064); сохранённый диапазон строк 3550–3583; SHA-256 фрагмента: 12c054b7492f01dfc859a37e73c3b447c7f545c197c48a20840c85999d5c73e6.
- [Архивный снимок карточки 184](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-065

Business selection screen remains Russian after switching language

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-065); сохранённый диапазон строк 3584–3614; SHA-256 фрагмента: 2acee1a09b899fdc35ca0cc649b51033e11b7e26eb47124ce27c4e40085ceb24.
- [Архивный снимок карточки 185](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-066

Quick-action hover makes card text unreadable in the dark dashboard

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-066); сохранённый диапазон строк 3615–3644; SHA-256 фрагмента: 434e0f7b23f08d8c587a3b4abdfae1aa988cf96cafde6cf67fa2f53f583185af.
- [Архивный снимок карточки 186](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-067

Owner dashboard presents platform-wide provider health as a business integration status

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-067); сохранённый диапазон строк 3645–3683; SHA-256 фрагмента: 14607c8c98bab75eeeb3269ed26659d7ffb3d39f7aede0e2a60bb12bbd6710bd.
- [Архивный снимок карточки 187](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-068

Applicant or owner personal phone is used as the public business contact

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-068); сохранённый диапазон строк 3684–3719; SHA-256 фрагмента: cf3c0d4f75787c60b343ee40bf6a883378a9f402cf9538528ad61ed469aab9b5.
- [Архивный снимок карточки 188](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-069

Dashboard remains partially Russian after switching to English or Kyrgyz

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-069); сохранённый диапазон строк 3720–3751; SHA-256 фрагмента: ba252a553233f5c2736f79bed3ccb194b4047d123274e83422e53e74d043e142.
- [Архивный снимок карточки 189](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-070

Production build depends on live Google Fonts availability

- Уровень: P2; состояние: **Исторически open/reopened**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-070); сохранённый диапазон строк 3752–3774; SHA-256 фрагмента: c38be4b5e4e2dd6083a04785dca1aac0aabe9cfe8a02ced084058c5ee9e36f52.
- [Архивный снимок карточки 190](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-071

Temporary connectivity loss can leave a valid business page in a false not-found state

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-071); сохранённый диапазон строк 3775–3809; SHA-256 фрагмента: fdabd7f11ffa53b7220935ede85bc30ee21d91f1fe2a719b0895335fe6a95ba1.
- [Архивный снимок карточки 191](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-072

Header dropdown mixes cabinet and business switching and does not identify the current cabinet

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-072); сохранённый диапазон строк 3810–3844; SHA-256 фрагмента: e908b739d2586fd955b762de2dc9e333745063536b4dac5b9def282f6b8b8af2.
- [Архивный снимок карточки 192](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-073

Business switching has no clear pending state or protection against repeated actions

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-073); сохранённый диапазон строк 3845–3879; SHA-256 фрагмента: fc3b9aecad5b3ea8a554945fce687d7963e4e98c6bc78e4f3f4e07856bd77c69.
- [Архивный снимок карточки 193](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-074

Enabled contact inheritance does not show which business values a new branch will publish

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-074); сохранённый диапазон строк 3880–3914; SHA-256 фрагмента: 72e5a3420458a94c8767c5702b9673d1ae1a482181113962b575aa1e2604f73b.
- [Архивный снимок карточки 194](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-075

Auth status updater can create repeated Server Component refreshes and multiply transient Supabase errors

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-075); сохранённый диапазон строк 3915–3954; SHA-256 фрагмента: a16a606a058a50cc37950576f2f94c4b93aac70476ce2d9aad9b8181851164b9.
- [Архивный снимок карточки 195](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-076

New-branch page remains partially Russian after switching to English or Kyrgyz

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-076); сохранённый диапазон строк 3955–3990; SHA-256 фрагмента: 3ad82e7dea0e9e0d1dc821401f2c79dc96fbe34ab9447b7938a0c677fdceda89.
- [Архивный снимок карточки 196](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-077

Service-unavailable recovery keeps the reload action in Russian under English locale

- Уровень: P2; состояние: **Заявлено verified; первичный файл не найден**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-077); сохранённый диапазон строк 3991–4019; SHA-256 фрагмента: 40c676e7bc087517dc55e06dcb98d15f22fc107f1e6019e667ddc29a2b9ff92f.
- [Архивный снимок карточки 197](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-078

Branch edit page fails on ambiguous businesses embed and exposes the PostgREST error

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-078); сохранённый диапазон строк 4020–4055; SHA-256 фрагмента: 47b2bebd4021b1361ccb184580704561111c77a21dd669f1d09b168627405798.
- [Архивный снимок карточки 198](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-079

Recoverable Yandex Maps initialization failure opens the Next.js error overlay and cannot retry

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-079); сохранённый диапазон строк 4056–4087; SHA-256 фрагмента: 42e4c7b1f306d94d3b9b50d2b08f1fcca7d23952774a8838685877ad874ef8bb.
- [Архивный снимок карточки 199](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-080

Branch edit route does not pass Yandex Maps configuration or business contact inheritance data

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-080); сохранённый диапазон строк 4088–4119; SHA-256 фрагмента: 6cc9d9e5fcdf622f5c06943ae4944020a8c28ffbe175332368d4e0767cf9e562.
- [Архивный снимок карточки 200](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-081

Dashboard workspace drawer obscures tablet content and competes with the global mobile menu

- Уровень: P1; состояние: **Исправлено; проверка не завершена**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-081); сохранённый диапазон строк 4152–4188; SHA-256 фрагмента: 35461b3072d8e70fda94db1aacdd639f17564e7570a29a43acd5fa0d5f58a229.
- [Архивный снимок карточки 203](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Первичный файл для исходного утверждения не найден; поздние упоминания WB не подменяют исходный retest.
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-082

Clearing service duration forces zero and turns a new 30-minute value into 030

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-082); сохранённый диапазон строк 4189–4219; SHA-256 фрагмента: 184e3e5019f69be6af900c7d942b57e3a19964fe41e1a37628a1b16da47c6da6.
- [Архивный снимок карточки 204](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G005-service-lifecycle-after.json](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-after.json).
- Уточнение старого статуса отдельным follow-up: Owner service duration: clear → empty → type 30 → saved 30. G005 explicitly confirms the old fix. No new fix; not whole service/device/production acceptance. Исходная карточка сохранена без перезаписи.
- Граница: Owner service duration: clear → empty → type 30 → saved 30. G005 explicitly confirms the old fix. No new fix; not whole service/device/production acceptance.

## WB-083

ночной прогон 2026-10-09, night-web-011

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-083); сохранённый диапазон строк 4120–4135; SHA-256 фрагмента: 23a36b0de9bc301da1bf6bbc11fb61daa4c4758072a69749d66403bbe0b21572.
- [Архивный снимок карточки 201](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [staff-stage.json](../apps/web/test-results/night-2026-10-09/staff-stage.json), [shift-close-preserved-time.jpg](../apps/web/test-results/night-2026-10-09/shift-close-preserved-time.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-084

ночной прогон 2026-10-09, night-web-012

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-084); сохранённый диапазон строк 4136–4151; SHA-256 фрагмента: a0f77e051d0d227581bef113d057517e9670bf07781ea128f82942fa02434c5e.
- [Архивный снимок карточки 202](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [owner-finance-empty-before.jpg](../apps/web/test-results/night-2026-10-09/owner-finance-empty-before.jpg), [owner-finance-after.jpg](../apps/web/test-results/night-2026-10-09/owner-finance-after.jpg), [owner-stage.json](../apps/web/test-results/night-2026-10-09/owner-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-085

QuickDesk не позволяет создать запись: отсутствуют параметры визита, статус постоянно загружается.

- Уровень: P0; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-085); сохранённый диапазон строк 1260–1271; SHA-256 фрагмента: 39ad217301bb07fab0833403ee2b1f13a4c316cff7149f02d1fcde1f105b542d.
- [Архивный снимок карточки 115](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [operations-stage.json](../apps/web/test-results/night-2026-10-09/operations-stage.json), [quickdesk-missing-controls-before.jpg](../apps/web/test-results/night-2026-10-09/quickdesk-missing-controls-before.jpg), [quickdesk-created-calendar.jpg](../apps/web/test-results/night-2026-10-09/quickdesk-created-calendar.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-086

Рабочее место броней смешивает английский, русский и кыргызский тексты.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-086); сохранённый диапазон строк 1272–1282; SHA-256 фрагмента: 2186390bb6fbcb1969be36d9abd74ce8f08dcfaf51e78e6625005ed424daaced.
- [Архивный снимок карточки 116](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [operations-stage.json](../apps/web/test-results/night-2026-10-09/operations-stage.json), [bookings-russian-before.jpg](../apps/web/test-results/night-2026-10-09/bookings-russian-before.jpg), [bookings-english-before.jpg](../apps/web/test-results/night-2026-10-09/bookings-english-before.jpg), [bookings-history-english-before.jpg](../apps/web/test-results/night-2026-10-09/bookings-history-english-before.jpg), [quickdesk-english-after.jpg](../apps/web/test-results/night-2026-10-09/quickdesk-english-after.jpg), [quickdesk-cancelled-history-after.jpg](../apps/web/test-results/night-2026-10-09/quickdesk-cancelled-history-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-087

QuickDesk сохраняет запись, но не показывает результат пользователю.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-087); сохранённый диапазон строк 1283–1293; SHA-256 фрагмента: dbb1dd5ca03983924f3e17f069db82827d42451fc139f5955b14cc22addfb1b6.
- [Архивный снимок карточки 117](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [operations-stage.json](../apps/web/test-results/night-2026-10-09/operations-stage.json), [quickdesk-confirmation-after.jpg](../apps/web/test-results/night-2026-10-09/quickdesk-confirmation-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-088

После изменения поиска QuickDesk сохраняет невидимого ранее выбранного клиента.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-088); сохранённый диапазон строк 1294–1304; SHA-256 фрагмента: b4628046445a06e079e43d73cd21ed4cd213d02daf9529e30f86e8610790e295.
- [Архивный снимок карточки 118](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [operations-stage.json](../apps/web/test-results/night-2026-10-09/operations-stage.json), [quickdesk-stale-client-before.jpg](../apps/web/test-results/night-2026-10-09/quickdesk-stale-client-before.jpg), [quickdesk-stale-client-after.jpg](../apps/web/test-results/night-2026-10-09/quickdesk-stale-client-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-089

Месячный фильтр финансов отправляет дневную дату и блокирует отчёт ошибкой.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-089); сохранённый диапазон строк 1305–1319; SHA-256 фрагмента: b331c2bb94f539393cba50e784656db3e6f30a21a9c493268993b8de2c32cce8.
- [Архивный снимок карточки 119](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [finance-stage.json](../apps/web/test-results/night-2026-10-09/finance-stage.json), [finance-month-filter-before.jpg](../apps/web/test-results/night-2026-10-09/finance-month-filter-before.jpg), [finance-month-filter-after.jpg](../apps/web/test-results/night-2026-10-09/finance-month-filter-after.jpg), [finance-error-controls-after.jpg](../apps/web/test-results/night-2026-10-09/finance-error-controls-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-090

Аналитика не использует выбранный язык.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-090); сохранённый диапазон строк 1227–1237; SHA-256 фрагмента: 193c5477a1e6d1f959aa659035db2ee66dd54486b6e8f19339280e6440d7c6c1.
- [Архивный снимок карточки 112](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [analytics-stage.json](../apps/web/test-results/night-2026-10-09/analytics-stage.json), [analytics-language-before.jpg](../apps/web/test-results/night-2026-10-09/analytics-language-before.jpg), [analytics-language-after.jpg](../apps/web/test-results/night-2026-10-09/analytics-language-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-091

Ошибка даты аналитики удаляет фильтры и не позволяет восстановиться.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-091); сохранённый диапазон строк 1238–1248; SHA-256 фрагмента: 31baf8b134ba470a37d8aa02f9413f3031db47545f1fd6c89a060cc1fb03e2da.
- [Архивный снимок карточки 113](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [analytics-error-before.jpg](../apps/web/test-results/night-2026-10-09/analytics-error-before.jpg), [analytics-error-after.jpg](../apps/web/test-results/night-2026-10-09/analytics-error-after.jpg), [analytics-stage.json](../apps/web/test-results/night-2026-10-09/analytics-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-092

Быстрые периоды аналитики включают лишний день.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-092); сохранённый диапазон строк 1249–1259; SHA-256 фрагмента: 9e12e7dc42214bb630811d62be43a567e620d0a5e2bb090744eecd8b5cf4735f.
- [Архивный снимок карточки 114](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [analytics-stage.json](../apps/web/test-results/night-2026-10-09/analytics-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-093

В настройках контактов вместо причины отказа показан код validation.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-093); сохранённый диапазон строк 1216–1226; SHA-256 фрагмента: 47d923b9ac7d952ea4bd8ef2d0c1706eeff4fad212f8166b88199f22eabdf654.
- [Архивный снимок карточки 111](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [settings-stage.json](../apps/web/test-results/night-2026-10-09/settings-stage.json), [contacts-validation-before.jpg](../apps/web/test-results/night-2026-10-09/contacts-validation-before.jpg), [contacts-validation-after.jpg](../apps/web/test-results/night-2026-10-09/contacts-validation-after.jpg), [contacts-restored.jpg](../apps/web/test-results/night-2026-10-09/contacts-restored.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-094

Вместо названий категорий каталог и карта показывают технические slug.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-094); сохранённый диапазон строк 1206–1215; SHA-256 фрагмента: a8ceed64b24cb5bf2cf227218eb28319395b4d2bea038864287d19e61a757fd7.
- [Архивный снимок карточки 110](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [public-stage.json](../apps/web/test-results/night-2026-10-09/public-stage.json), [home-category-before.jpg](../apps/web/test-results/night-2026-10-09/home-category-before.jpg), [home-category-after.jpg](../apps/web/test-results/night-2026-10-09/home-category-after.jpg), [map-category-before.jpg](../apps/web/test-results/night-2026-10-09/map-category-before.jpg), [map-category-after.jpg](../apps/web/test-results/night-2026-10-09/map-category-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-095

Переход с выбранного филиала карты теряет выбор филиала.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-095); сохранённый диапазон строк 1195–1205; SHA-256 фрагмента: 7d31f1dbf7d4da65973d2fcb50f91a5524f7343db03ca14eec59378f119c89af.
- [Архивный снимок карточки 109](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [public-stage.json](../apps/web/test-results/night-2026-10-09/public-stage.json), [map-branch-context-before.jpg](../apps/web/test-results/night-2026-10-09/map-branch-context-before.jpg), [map-branch-context-after.jpg](../apps/web/test-results/night-2026-10-09/map-branch-context-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-096

Модерация показывает внутренние risk-флаги и непереведённые статусы.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-096); сохранённый диапазон строк 1185–1194; SHA-256 фрагмента: 0e3cdf720215259f079a6aada97678fa115f26a40862792eb68a1ec654e09a55.
- [Архивный снимок карточки 108](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [admin-stage.json](../apps/web/test-results/night-2026-10-09/admin-stage.json), [admin-risk-flags-before.jpg](../apps/web/test-results/night-2026-10-09/admin-risk-flags-before.jpg), [admin-role-status-before.jpg](../apps/web/test-results/night-2026-10-09/admin-role-status-before.jpg), [admin-risk-flags-after.jpg](../apps/web/test-results/night-2026-10-09/admin-risk-flags-after.jpg), [admin-role-status-after.jpg](../apps/web/test-results/night-2026-10-09/admin-role-status-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-097

Сохранение категории не работает из-за неразрешённых параметров Next.js.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-097); сохранённый диапазон строк 1174–1184; SHA-256 фрагмента: f71670d1a344a7bc8e83f9eff26d96d84d6d8a9b15a0a0f72f512ed6c5811d3d.
- [Архивный снимок карточки 107](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [admin-stage.json](../apps/web/test-results/night-2026-10-09/admin-stage.json), [admin-category-edit-before.jpg](../apps/web/test-results/night-2026-10-09/admin-category-edit-before.jpg), [admin-category-edit-after.jpg](../apps/web/test-results/night-2026-10-09/admin-category-edit-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-098

Сводка пользователей показывает ложные нули.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-098); сохранённый диапазон строк 1164–1173; SHA-256 фрагмента: 443c8e13498cdbbace317ba21ba344e008c21519b2ba70e74bd8992249ba01ee.
- [Архивный снимок карточки 106](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [admin-stage.json](../apps/web/test-results/night-2026-10-09/admin-stage.json), [admin-users-count-before.jpg](../apps/web/test-results/night-2026-10-09/admin-users-count-before.jpg), [admin-users-count-after.jpg](../apps/web/test-results/night-2026-10-09/admin-users-count-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-099

Публичная запись и клиентская отмена сохраняются без Telegram-уведомлений.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-099); сохранённый диапазон строк 1153–1163; SHA-256 фрагмента: 2c1920641145b302485468502d68e4ae758f316572bfbf0f5afd0cae411e17c4.
- [Архивный снимок карточки 105](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [notifications-stage.json](../apps/web/test-results/night-2026-10-09/notifications-stage.json), [notification-missing-before.jpg](../apps/web/test-results/night-2026-10-09/notification-missing-before.jpg), [notification-confirm-after.jpg](../apps/web/test-results/night-2026-10-09/notification-confirm-after.jpg), [notification-cancel-after.jpg](../apps/web/test-results/night-2026-10-09/notification-cancel-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-100

Совмещение владельца и клиента дублирует одинаковое Telegram-уведомление.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-100); сохранённый диапазон строк 1142–1152; SHA-256 фрагмента: d23fa51d6701d30a82e92c752ae4bd36d630d3c358877538f05ee37086ceee80.
- [Архивный снимок карточки 104](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [notifications-stage.json](../apps/web/test-results/night-2026-10-09/notifications-stage.json), [notification-confirm-after.jpg](../apps/web/test-results/night-2026-10-09/notification-confirm-after.jpg), [notification-cancel-after.jpg](../apps/web/test-results/night-2026-10-09/notification-cancel-after.jpg), [notification-deduplicated-after.jpg](../apps/web/test-results/night-2026-10-09/notification-deduplicated-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-101

Неверная форма количества записей в пустом кабинете клиента.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-101); сохранённый диапазон строк 1131–1141; SHA-256 фрагмента: ddf5aa3bac33e8b6d88d5b00c3bc0e97447377162baa0b2cae08de47f7ab0dc1.
- [Архивный снимок карточки 103](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [cabinet-stage.json](../apps/web/test-results/night-2026-10-09/cabinet-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-102

Сохранённые акции не появляются в кабинете владельца.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-102); сохранённый диапазон строк 1120–1130; SHA-256 фрагмента: 7d990f91d66d2416aed68689904c39ee9c64931f7c7280f5dbbf00f8842a4ee2.
- [Архивный снимок карточки 102](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [promotions-stage.json](../apps/web/test-results/night-2026-10-09/promotions-stage.json), [promotions-empty-before.jpg](../apps/web/test-results/night-2026-10-09/promotions-empty-before.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-103

Подпись активности акции переключает активность филиала.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-103); сохранённый диапазон строк 1109–1119; SHA-256 фрагмента: 36b95c631a420a136517c8461f89044988943e47c5efe98b18f8f61ea83d497b.
- [Архивный снимок карточки 101](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [promotions-stage.json](../apps/web/test-results/night-2026-10-09/promotions-stage.json), [promotion-activity-label-before.jpg](../apps/web/test-results/night-2026-10-09/promotion-activity-label-before.jpg), [promotion-activity-label-after.jpg](../apps/web/test-results/night-2026-10-09/promotion-activity-label-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-104

Ожидаемый конфликт занятого слота показан как техническая ошибка без восстановления формы.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-104); сохранённый диапазон строк 1097–1108; SHA-256 фрагмента: 1531c55bd4c394e783cc103069335933446616f01644113b36288f15cbff00e8.
- [Архивный снимок карточки 100](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [booking-conflict-stage.json](../apps/web/test-results/night-2026-10-09/booking-conflict-stage.json), [booking-slot-conflict-after.jpg](../apps/web/test-results/night-2026-10-09/booking-slot-conflict-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-105

Заголовок финансов сотрудника у владельца содержит английскую навигацию в RU.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-105); сохранённый диапазон строк 1086–1096; SHA-256 фрагмента: 8cbf8e0675eb84f9387e2eec37caac9d321bd7236487916f1deb7bbfe50e5131.
- [Архивный снимок карточки 99](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [owner-shift-language-before.jpg](../apps/web/test-results/night-2026-10-09/owner-shift-language-before.jpg), [owner-shift-clients-en-after.jpg](../apps/web/test-results/night-2026-10-09/owner-shift-clients-en-after.jpg), [owner-shift-stage.json](../apps/web/test-results/night-2026-10-09/owner-shift-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-106

Список клиентов смены сохраняет русские подписи и пояснение запрета в EN/KY.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-106); сохранённый диапазон строк 1074–1085; SHA-256 фрагмента: 7943a5c88af000ecb1503fb416bc8878f4a04dc6e5efff7126d1d16b4fdd83ac.
- [Архивный снимок карточки 98](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [owner-shift-stage.json](../apps/web/test-results/night-2026-10-09/owner-shift-stage.json), [owner-shift-clients-en-before.jpg](../apps/web/test-results/night-2026-10-09/owner-shift-clients-en-before.jpg), [owner-shift-clients-en-after.jpg](../apps/web/test-results/night-2026-10-09/owner-shift-clients-en-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-107

Закрытие смены владельцем пересоздаёт сохранённые позиции клиентов.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-107); сохранённый диапазон строк 1062–1073; SHA-256 фрагмента: 90a6e3264112aa43a58fd1641ffce3382093144c28fa3397c7341c2fa4a038dc.
- [Архивный снимок карточки 97](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [owner-shift-stage.json](../apps/web/test-results/night-2026-10-09/owner-shift-stage.json), [owner-shift-open-before.jpg](../apps/web/test-results/night-2026-10-09/owner-shift-open-before.jpg), [owner-shift-item-time-before.jpg](../apps/web/test-results/night-2026-10-09/owner-shift-item-time-before.jpg), [owner-shift-item-time-after.jpg](../apps/web/test-results/night-2026-10-09/owner-shift-item-time-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-108

Финансовый обзор использует разные основания суммы и процентов, создавая видимость выплаты 116.2%.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-108); сохранённый диапазон строк 1050–1061; SHA-256 фрагмента: bbbfbf8348106abcfb65a43c9ad6b9ecf0bffeacb91a3c92861500646562c968.
- [Архивный снимок карточки 96](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [finance-stage.json](../apps/web/test-results/night-2026-10-09/finance-stage.json), [owner-finance-percent-before.jpg](../apps/web/test-results/night-2026-10-09/owner-finance-percent-before.jpg), [owner-finance-basis-after.jpg](../apps/web/test-results/night-2026-10-09/owner-finance-basis-after.jpg), [owner-shift-stage.json](../apps/web/test-results/night-2026-10-09/owner-shift-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-109

После переключения бизнеса клиентская страница сохраняет данные и фильтры предыдущего бизнеса.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-109); сохранённый диапазон строк 1038–1049; SHA-256 фрагмента: 1d3a1852c833134fc1eb3acca9c4ded5bec07820ec70d0085d6b194e7608eec9.
- [Архивный снимок карточки 95](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [business-scope-stage.json](../apps/web/test-results/night-2026-10-09/business-scope-stage.json), [analytics-business-switch-before.jpg](../apps/web/test-results/night-2026-10-09/analytics-business-switch-before.jpg), [analytics-business-switch-after.jpg](../apps/web/test-results/night-2026-10-09/analytics-business-switch-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-110

Глобальная аналитика суперадмина требует выбранный бизнес и перенаправляет обратно.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-110); сохранённый диапазон строк 1027–1037; SHA-256 фрагмента: 072e46729ab8f21c54839dbfa4aaf9699fefde468f1a92d2ea9d8b0da823a4ff.
- [Архивный снимок карточки 94](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [funnel-stage.json](../apps/web/test-results/night-2026-10-09/funnel-stage.json), [admin-funnel-redirect-before.jpg](../apps/web/test-results/night-2026-10-09/admin-funnel-redirect-before.jpg), [admin-funnel-owner-denied.jpg](../apps/web/test-results/night-2026-10-09/admin-funnel-owner-denied.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-111

Клиент глобальной воронки обращается к несуществующему адресу API.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-111); сохранённый диапазон строк 1016–1026; SHA-256 фрагмента: 33702ff120d9ced7b2cdf5aea62293e95a801d7c11f48a6288d18207695fb1d5.
- [Архивный снимок карточки 93](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [funnel-stage.json](../apps/web/test-results/night-2026-10-09/funnel-stage.json), [admin-funnel-route-before.jpg](../apps/web/test-results/night-2026-10-09/admin-funnel-route-before.jpg), [admin-funnel-schema-before.jpg](../apps/web/test-results/night-2026-10-09/admin-funnel-schema-before.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-112

Гранулярная воронка не имеет своей таблицы событий в основной базе разработки.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-112); сохранённый диапазон строк 991–1003; SHA-256 фрагмента: 7a4ff929eb45d0ce2e22ad79da706bb63b7f99fcbe2cb4e1b34cc0c6c563e691.
- [Архивный снимок карточки 91](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [funnel-stage.json](../apps/web/test-results/night-2026-10-09/funnel-stage.json), [admin-funnel-schema-before.jpg](../apps/web/test-results/night-2026-10-09/admin-funnel-schema-before.jpg), [admin-funnel-data-after.jpg](../apps/web/test-results/night-2026-10-09/admin-funnel-data-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-113

Гостевая запись создаётся, но внутренний запрос отправки уведомления теряет авторизацию.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-113); сохранённый диапазон строк 1004–1015; SHA-256 фрагмента: 4a3ad3e509e64e9ef02fd5e7ef7d53286eba0e7fec44f556bfa3e1a5bbcc87ca.
- [Архивный снимок карточки 92](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [guest-stage.json](../apps/web/test-results/night-2026-10-09/guest-stage.json), [guest-notification-before.jpg](../apps/web/test-results/night-2026-10-09/guest-notification-before.jpg), [guest-notification-after.jpg](../apps/web/test-results/night-2026-10-09/guest-notification-after.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-114

Успешная гостевая запись отсутствует на последнем шаге публичной воронки.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-114); сохранённый диапазон строк 979–990; SHA-256 фрагмента: 0e93672d4599227def794d2d6cf81399fb252195a4fd61e2563b39f3fc890fd1.
- [Архивный снимок карточки 90](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [funnel-stage.json](../apps/web/test-results/night-2026-10-09/funnel-stage.json), [admin-funnel-data-after.jpg](../apps/web/test-results/night-2026-10-09/admin-funnel-data-after.jpg), [admin-funnel-guest-success-after.jpg](../apps/web/test-results/night-2026-10-09/admin-funnel-guest-success-after.jpg), [guest-stage.json](../apps/web/test-results/night-2026-10-09/guest-stage.json), [guest-final-cancelled.jpg](../apps/web/test-results/night-2026-10-09/guest-final-cancelled.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-115

Счётчик готовности русского кабинета показывает «1 open».

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-115); сохранённый диапазон строк 905–911; SHA-256 фрагмента: 7c6e9dedf2c756095efba15bec59d4d77edde8a6f7885d51c7a0736a598ff791.
- [Архивный снимок карточки 80](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [owner-dashboard-before.jpg](../apps/web/test-results/night-2026-10-09/owner-dashboard-before.jpg), [progress.json](../apps/web/test-results/night-2026-10-09/progress.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-116

Длительность услуги сотрудника отображается испорченной кодировкой.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-116); сохранённый диапазон строк 912–917; SHA-256 фрагмента: 038a2a566ee61694171db8754a2e75fb05aacc0e93007469a5381322acb76fbc.
- [Архивный снимок карточки 81](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [owner-stage.json](../apps/web/test-results/night-2026-10-09/owner-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-117

Период рейтинга сотрудника выводит шаблон {days}.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-117); сохранённый диапазон строк 918–923; SHA-256 фрагмента: 64c0b6ab89c977efa1163231b718ebb7fc9efcd5f11ce86c8ef6a9d44f12476e.
- [Архивный снимок карточки 82](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [owner-stage.json](../apps/web/test-results/night-2026-10-09/owner-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-118

Google-вход из записи теряет явное место возврата и отправляет в кабинет роли.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-118); сохранённый диапазон строк 924–931; SHA-256 фрагмента: 6080d14cb7ffa41edcccbae58edc6c7e8ed4b281558c2130d760d8578e64c23a.
- [Архивный снимок карточки 83](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [client-stage.json](../apps/web/test-results/night-2026-10-09/client-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-119

Асинхронный старт записи удаляет корректную услугу из URL.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-119); сохранённый диапазон строк 932–939; SHA-256 фрагмента: fca6b3df644fb38f98e2238d9b2f9831b8c1c566f9a86f539ac30add81c36fb5.
- [Архивный снимок карточки 84](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [client-stage.json](../apps/web/test-results/night-2026-10-09/client-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-120

Сводка, история и отмена клиентской записи смешивают языки.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-120); сохранённый диапазон строк 940–946; SHA-256 фрагмента: d7e5b99328135b20514294fb13d240648632858da75e1fd9824dab88a074e762.
- [Архивный снимок карточки 85](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [client-stage.json](../apps/web/test-results/night-2026-10-09/client-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-121

В выходной сотруднику предлагают открыть недоступную смену без объяснения.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-121); сохранённый диапазон строк 947–954; SHA-256 фрагмента: 012c772bd78ee5fd3b45a0171b83e8912302e68a1e0a594b0c28b42ae7860709.
- [Архивный снимок карточки 86](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [staff-stage.json](../apps/web/test-results/night-2026-10-09/staff-stage.json), [staff-day-off-before.jpg](../apps/web/test-results/night-2026-10-09/staff-day-off-before.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-122

Название выбранной даты/месяца содержит {value}.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-122); сохранённый диапазон строк 955–962; SHA-256 фрагмента: ec2772aeeed80b8d59c8f6363309b2ffff1f143bb98797b6fb3ad8a156a30e75.
- [Архивный снимок карточки 87](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [staff-stage.json](../apps/web/test-results/night-2026-10-09/staff-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-123

Подсказка имени клиента ручной смены показывает {name}.

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-123); сохранённый диапазон строк 963–970; SHA-256 фрагмента: 0478a8f070419ea3524f0e4b8b9ab7ca2e2346f19daffd7e49ee6e642f687936.
- [Архивный снимок карточки 88](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [staff-stage.json](../apps/web/test-results/night-2026-10-09/staff-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-124

Сохранённые клиенты исчезают из закрытой смены сотрудника.

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-124); сохранённый диапазон строк 971–978; SHA-256 фрагмента: 291e64fd4989ff574153559cd2dc7b06cbd1f9fc9fcef0b0c3cc4aa89079af63.
- [Архивный снимок карточки 89](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [staff-stage.json](../apps/web/test-results/night-2026-10-09/staff-stage.json), [closed-shift-items-before.jpg](../apps/web/test-results/night-2026-10-09/closed-shift-items-before.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-125

night-web-043

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-125); сохранённый диапазон строк 864–904; SHA-256 фрагмента: 21c1ffff32fe5d65e345a928226de9a9ab3adaa6e81216de5e0572012bdcad27.
- [Архивный снимок карточки 79](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [transfer-stage.json](../apps/web/test-results/night-2026-10-09/transfer-stage.json), [transfer-published.jpg](../apps/web/test-results/night-2026-10-09/transfer-published.jpg), [transfer-booking-confirmed.jpg](../apps/web/test-results/night-2026-10-09/transfer-booking-confirmed.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-126

night-web-044

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-126); сохранённый диапазон строк 852–863; SHA-256 фрагмента: 4c5c0524d8722de45d202424fb04e81908cb5f4cb07da955c2684cd545cd003d.
- [Архивный снимок карточки 78](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [complex-stage.json](../apps/web/test-results/night-2026-10-09/complex-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-127

night-web-045

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-127); сохранённый диапазон строк 838–851; SHA-256 фрагмента: 52f9b86df265d89f50b73ba287c0269cc017c4b30233b5a5e09f64c0449d2f10.
- [Архивный снимок карточки 77](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [complex-stage.json](../apps/web/test-results/night-2026-10-09/complex-stage.json), [guest-complex-receipt.jpg](../apps/web/test-results/night-2026-10-09/guest-complex-receipt.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-128

night-web-046

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-128); сохранённый диапазон строк 825–837; SHA-256 фрагмента: 0776647dcb7e9ae25aeed3d9ec9846629339d8935e850f6356216a1a73023f6d.
- [Архивный снимок карточки 76](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [guest-transfer-confirmed.jpg](../apps/web/test-results/night-2026-10-09/guest-transfer-confirmed.jpg), [guest-transfer-stage.json](../apps/web/test-results/night-2026-10-09/guest-transfer-stage.json), [transfer-stage.json](../apps/web/test-results/night-2026-10-09/transfer-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-129

night-web-047

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-129); сохранённый диапазон строк 811–824; SHA-256 фрагмента: e64257e00b12882a74804b9038915a6e872d5ccafd1d98fc0c9a8f613e22a414.
- [Архивный снимок карточки 75](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [guest-choice-stage.json](../apps/web/test-results/night-2026-10-09/guest-choice-stage.json), [guest-choice-copy-before.jpg](../apps/web/test-results/night-2026-10-09/guest-choice-copy-before.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-130

night-web-048

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-130); сохранённый диапазон строк 797–810; SHA-256 фрагмента: de5a2387e0af9f1fcf036edbda018799acc0dc3198ed3e6bd46c059b123a2887.
- [Архивный снимок карточки 74](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [booking-wizard-language-stage.json](../apps/web/test-results/night-2026-10-09/booking-wizard-language-stage.json), [booking-wizard-ky-mixed-before.jpg](../apps/web/test-results/night-2026-10-09/booking-wizard-ky-mixed-before.jpg).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-131

night-web-049

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-131); сохранённый диапазон строк 783–796; SHA-256 фрагмента: 1615cce6fc36b803b73a45faac096e8063b2b952745eb59a49ef13b40b50b9ee.
- [Архивный снимок карточки 73](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [booking-auth-choice-language-stage.json](../apps/web/test-results/night-2026-10-09/booking-auth-choice-language-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-132

night-web-050

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-132); сохранённый диапазон строк 769–782; SHA-256 фрагмента: ed01de3fbd1e42974a12f9bc6dfae21f28f3b8b706b95aba9e1363e7eaccd9b9.
- [Архивный снимок карточки 72](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [guest-form-language-stage.json](../apps/web/test-results/night-2026-10-09/guest-form-language-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-133

night-web-051

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-133); сохранённый диапазон строк 756–768; SHA-256 фрагмента: f204cd28b8b8894691b244e55626b98f0ba7cfd62069443d0a69fcb8c0fccced.
- [Архивный снимок карточки 71](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [guest-dashboard-guard-stage.json](../apps/web/test-results/night-2026-10-09/guest-dashboard-guard-stage.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-134

live-2026-10-11-001

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-134); сохранённый диапазон строк 742–755; SHA-256 фрагмента: 8d579a4f3278307766daa332f7385c9dde2ce5de018344d30e7d6399ce3b46db.
- [Архивный снимок карточки 70](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-002-booking-cancel.json](../apps/web/test-results/live-2026-10-11/stage-002-booking-cancel.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-135

live-2026-10-11-002

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-135); сохранённый диапазон строк 727–741; SHA-256 фрагмента: 733258445d97629fe21e97cc595d20778785314f4ac77bb0699ad41f120c8e91.
- [Архивный снимок карточки 69](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-003-history-search.json](../apps/web/test-results/live-2026-10-11/stage-003-history-search.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-136

live-2026-10-11-003

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-136); сохранённый диапазон строк 714–726; SHA-256 фрагмента: 568116702e97b6adf3251a6bba48f632902a25837050e364c4673214db49ef37.
- [Архивный снимок карточки 68](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-004-promotion-errors.json](../apps/web/test-results/live-2026-10-11/stage-004-promotion-errors.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-137

live-2026-10-11-004

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-137); сохранённый диапазон строк 699–713; SHA-256 фрагмента: ddb6ef5a7211d1699cffa1eac62d4284f72ec937c719ef14473391335bf44378.
- [Архивный снимок карточки 67](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-004-promotion-errors.json](../apps/web/test-results/live-2026-10-11/stage-004-promotion-errors.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-138

live-2026-10-11-005

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-138); сохранённый диапазон строк 685–698; SHA-256 фрагмента: c968ceaa2ee4db3e85f4ab9ba7a7c63a0dcf423dbb532027789b56cba7587814.
- [Архивный снимок карточки 66](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-005-finance-hours.json](../apps/web/test-results/live-2026-10-11/stage-005-finance-hours.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-139

live-2026-10-11-006

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-139); сохранённый диапазон строк 671–684; SHA-256 фрагмента: df8f9c7b62717ba733d5821015efd1d9cdc5d009079cbf1c6d6e5f64a524a004.
- [Архивный снимок карточки 65](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-005-finance-hours.json](../apps/web/test-results/live-2026-10-11/stage-005-finance-hours.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-140

live-2026-10-11-007

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-140); сохранённый диапазон строк 652–670; SHA-256 фрагмента: 28f773e0250f35b124dba35d93de57452b715be94ee9d1c1321b6df1180fa4ad.
- [Архивный снимок карточки 64](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G120-month-picker-locale-after.json](../apps/web/test-results/global-2026-10-17/stage-G120-month-picker-locale-after.json), [stage-G099-finance-static-labels-after.json](../apps/web/test-results/global-2026-10-16/stage-G099-finance-static-labels-after.json), [stage-006-finance-translations.json](../apps/web/test-results/live-2026-10-11/stage-006-finance-translations.json), [stage-G131-branch-business-context-after.json](../apps/web/test-results/global-2026-10-17/stage-G131-branch-business-context-after.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-141

live-2026-10-11-008

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-141); сохранённый диапазон строк 639–651; SHA-256 фрагмента: a2fb0da2b7fdc35f39a0330e97130a98c51621f0b870741ce91a9eee593bb4c4.
- [Архивный снимок карточки 63](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-007-finance-accessible-fields.json](../apps/web/test-results/live-2026-10-11/stage-007-finance-accessible-fields.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-142

live-2026-10-12 continuation-001

- Уровень: P0; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-142); сохранённый диапазон строк 625–638; SHA-256 фрагмента: d03cbe8a662436a31f040db3418cd2a121e1cd0b4df62dd3f15d8ea304a115a6.
- [Архивный снимок карточки 62](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-010-finance-save-duplicate.json](../apps/web/test-results/live-2026-10-11/stage-010-finance-save-duplicate.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-143

live-2026-10-12 continuation observation

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-143); сохранённый диапазон строк 612–624; SHA-256 фрагмента: c296a41328a26c028c5dd1d7c26460c46d810a27bf72a809cd141ad13ca95b7e.
- [Архивный снимок карточки 61](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-010-finance-save-duplicate.json](../apps/web/test-results/live-2026-10-11/stage-010-finance-save-duplicate.json), [stage-011-summary-revenue.json](../apps/web/test-results/live-2026-10-11/stage-011-summary-revenue.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-144

live-2026-10-12 summary localization

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-144); сохранённый диапазон строк 602–611; SHA-256 фрагмента: 95380b5a85c42a5298ee19dde90bf59bd1351d4630e1e1c8b4f99ce0c99bdffc.
- [Архивный снимок карточки 60](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-011-summary-revenue.json](../apps/web/test-results/live-2026-10-11/stage-011-summary-revenue.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-145

staff sidebar mixed untranslated workspace labels

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-145); сохранённый диапазон строк 593–601; SHA-256 фрагмента: 9c9951c70f628c0ecaae7bb2eed8ab5d451979441662a49e3e9cadcb2f521294.
- [Архивный снимок карточки 59](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-012-staff-workspace-locale.json](../apps/web/test-results/live-2026-10-11/stage-012-staff-workspace-locale.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-146

explicit staff schedule heading ignores locale

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-146); сохранённый диапазон строк 584–592; SHA-256 фрагмента: 970b8723f4ebac14e8d671d0168ac70b2c25a39f151300c511a9fa3ab960747c.
- [Архивный снимок карточки 58](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-012-staff-workspace-locale.json](../apps/web/test-results/live-2026-10-11/stage-012-staff-workspace-locale.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-147

Repeat opens business landing instead of booking flow

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-147); сохранённый диапазон строк 574–583; SHA-256 фрагмента: 5dd00213548501a416639ef3cc23c8329a8c1f070e7f3c4bf1cb283fcde67bb5.
- [Архивный снимок карточки 57](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-015-repeat-booking.json](../apps/web/test-results/live-2026-10-11/stage-015-repeat-booking.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-148

cabinet loses complex services and historical duration

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-148); сохранённый диапазон строк 565–573; SHA-256 фрагмента: d9fe0efbfd413d3a3e15df6a2f3899e7a1a017c47789829f08622e0316741307.
- [Архивный снимок карточки 56](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-016-cabinet-complex.json](../apps/web/test-results/live-2026-10-11/stage-016-cabinet-complex.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-149

complex cabinet labels untranslated

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-149); сохранённый диапазон строк 556–564; SHA-256 фрагмента: 01dfb4b0aba1a10e6810584a2c41f116755a61ec6d0bc18d354b058fb9733027.
- [Архивный снимок карточки 55](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-017-complex-copy.json](../apps/web/test-results/live-2026-10-11/stage-017-complex-copy.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-150

absent daily analytics presented as calculated zeros

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-150); сохранённый диапазон строк 547–555; SHA-256 фрагмента: 2654d327780710a9855e804ff532183916e9f3b5b8d44761e31831fcf2e85b1c.
- [Архивный снимок карточки 54](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-018-analytics-empty.json](../apps/web/test-results/live-2026-10-11/stage-018-analytics-empty.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-151

any-master confirmation navigates away while the command is in flight

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-151); сохранённый диапазон строк 536–546; SHA-256 фрагмента: c6e0e49a6240859b83c990dfc773d2125f6b48bdbfce82e80515b74dc619f15b.
- [Архивный снимок карточки 53](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-021-any-staff-command.json](../apps/web/test-results/live-2026-10-11/stage-021-any-staff-command.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-152

cancellation of a future booking disappears from the client cabinet

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-152); сохранённый диапазон строк 525–535; SHA-256 фрагмента: 59157848eaa9228a68412fb6a6954e64dc21138f8d7b6909d2e109af7a65edc8.
- [Архивный снимок карточки 52](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-022-client-cancellation-history.json](../apps/web/test-results/live-2026-10-11/stage-022-client-cancellation-history.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-153

business error Retry replays the cached server failure

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-153); сохранённый диапазон строк 514–524; SHA-256 фрагмента: 430f80eb1c880383c5e6825c65da52fc901711a2f80bbd720c03b48d43939d35.
- [Архивный снимок карточки 51](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-023-business-retry.json](../apps/web/test-results/live-2026-10-11/stage-023-business-retry.json), [stage-020-pure-client.json](../apps/web/test-results/live-2026-10-11/stage-020-pure-client.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-154

client projection omits terminal no-show status

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-154); сохранённый диапазон строк 504–513; SHA-256 фрагмента: 80318eb9ee30c1933cac4139bc7ea8050926883d7f8ff3c1a6e31392372db3b2.
- [Архивный снимок карточки 50](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-027-no-show-presentation.json](../apps/web/test-results/live-2026-10-11/stage-027-no-show-presentation.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-155

receipt body keeps a separate, stale language context

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-155); сохранённый диапазон строк 495–503; SHA-256 фрагмента: 09e11ceffe15824780d07cc017421ca80d6b7278c0e0e898dc37b5fe7f6ec353.
- [Архивный снимок карточки 49](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-027-no-show-presentation.json](../apps/web/test-results/live-2026-10-11/stage-027-no-show-presentation.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-156

linked existing clients appear as anonymous walk-ins in owner history

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-156); сохранённый диапазон строк 485–494; SHA-256 фрагмента: 4753186150666b5de6a910685e1bf9555396554ac9d8f08741428666920b1ff5.
- [Архивный снимок карточки 48](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-029-client-identity.json](../apps/web/test-results/live-2026-10-13/stage-029-client-identity.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-157

existing-review summary uses English copy in Russian and Kyrgyz

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-157); сохранённый диапазон строк 475–484; SHA-256 фрагмента: 1486a29843869858c6590f436211ffb9f1e3639634f24a7f4bf113182e7dc8d1.
- [Архивный снимок карточки 47](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-030-client-package-review.json](../apps/web/test-results/live-2026-10-13/stage-030-client-package-review.json), [review-regression.json](../apps/web/test-results/live-2026-10-13/review-regression.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-158

client search ignores the name saved in the profile

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-158); сохранённый диапазон строк 465–474; SHA-256 фрагмента: 1778dd45129a2af4caaa09790e5201f5888e95e58fa9dce34c82a29ddf0c3a4e.
- [Архивный снимок карточки 46](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-031-profile-name-search.json](../apps/web/test-results/live-2026-10-13/stage-031-profile-name-search.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-159

business listbox ignores Escape

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-159); сохранённый диапазон строк 455–464; SHA-256 фрагмента: c1d077409c594d80a0a1c32729c5d7d19f6b8e4c13a84eeacee466e9d8d94ec5.
- [Архивный снимок карточки 45](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-032-navigation-responsive.json](../apps/web/test-results/live-2026-10-13/stage-032-navigation-responsive.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-160

management access denial gives database-edit instructions to clients

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-160); сохранённый диапазон строк 445–454; SHA-256 фрагмента: c6d8fdd89cef6ba8e66f9613fdc8fdd3a76bbff345d21f5b8303ef13c1c931e5.
- [Архивный снимок карточки 44](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-034-client-boundaries.json](../apps/web/test-results/live-2026-10-13/stage-034-client-boundaries.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-161

staff access denial ignores selected English/Kyrgyz

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-161); сохранённый диапазон строк 435–444; SHA-256 фрагмента: 97998ef47600d63b1e2df33245099bab077ed8b39b16b02e1b8b5b4c8e55f5de.
- [Архивный снимок карточки 43](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-034-client-boundaries.json](../apps/web/test-results/live-2026-10-13/stage-034-client-boundaries.json), [staff-denial-before.json](../apps/web/test-results/live-2026-10-13/staff-denial-before.json), [client-boundary-regression.json](../apps/web/test-results/live-2026-10-13/client-boundary-regression.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-162

profile account-link guidance and Telegram help stay Russian

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-162); сохранённый диапазон строк 425–434; SHA-256 фрагмента: d0d19fbcf1220aa68a94895489f6bcadaaeea27795d2b240abe8f53bb6caf763.
- [Архивный снимок карточки 42](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-035-profile-language.json](../apps/web/test-results/live-2026-10-13/stage-035-profile-language.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-163

saved language starts in Russian before hydration

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-163); сохранённый диапазон строк 415–424; SHA-256 фрагмента: fb008ce1524e663b0f27bb82bc4c74bbefe5b50a717722f348d62277f776f01e.
- [Архивный снимок карточки 41](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-036-initial-locale.json](../apps/web/test-results/live-2026-10-13/stage-036-initial-locale.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-164

existing-visit warning drops the count and uses a Russian title

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-164); сохранённый диапазон строк 405–414; SHA-256 фрагмента: 2a293e5f9729ab419428a73bbb0eb0d4bd3bd5fc53078ba04547cfd613056f0f.
- [Архивный снимок карточки 40](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-038-repeat-slots.json](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-165

step5 localized copy and Kyrgyz weekday

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-165); сохранённый диапазон строк 395–404; SHA-256 фрагмента: cb3f68593aefac37e7bcaf858e4447b9c0205f230f82973af4e1f7ceb8cfec0c.
- [Архивный снимок карточки 38](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-039-slot-copy.json](../apps/web/test-results/live-2026-10-13/stage-039-slot-copy.json), [stage-038-repeat-slots.json](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-166

step5 localized copy and Kyrgyz weekday

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-166); сохранённый диапазон строк 395–404; SHA-256 фрагмента: cb3f68593aefac37e7bcaf858e4447b9c0205f230f82973af4e1f7ceb8cfec0c.
- [Архивный снимок карточки 39](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-039-slot-copy.json](../apps/web/test-results/live-2026-10-13/stage-039-slot-copy.json), [stage-038-repeat-slots.json](../apps/web/test-results/live-2026-10-13/stage-038-repeat-slots.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-167

specialist/service selection guidance and states remain Russian

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-167); сохранённый диапазон строк 385–394; SHA-256 фрагмента: c4f51783a2bdc275399765288a6724162de483642b3dbe7e2b13e7fc7fb38b3b.
- [Архивный снимок карточки 37](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-041-selector-copy.json](../apps/web/test-results/live-2026-10-13/stage-041-selector-copy.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-168

conflict recovery refreshes slots but leaves stale own-visit count

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-168); сохранённый диапазон строк 374–384; SHA-256 фрагмента: 30462672faf1614ee1b9a18f002c8c1d7fc870c46a48b9ac23c7b93dbba763b1.
- [Архивный снимок карточки 36](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-042-stale-slot-conflict.json](../apps/web/test-results/live-2026-10-13/stage-042-stale-slot-conflict.json), [stale-count-after.json](../apps/web/test-results/live-2026-10-13/stale-count-after.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-169

staff detail crashes for a unique review relation

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-169); сохранённый диапазон строк 364–373; SHA-256 фрагмента: b0c482638bcd4d6194b641b6566f0c735917a11c762da776f200ad8715598943.
- [Архивный снимок карточки 35](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-043-staff-details-review.json](../apps/web/test-results/live-2026-10-13/stage-043-staff-details-review.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-170

application boundary intercepts Next's not-found control signal

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-170); сохранённый диапазон строк 354–363; SHA-256 фрагмента: c3917170427198956ba26e6e12d4581240ebb9ac389b41bc1955a263602778b4.
- [Архивный снимок карточки 34](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-045-current-business-staff-guard.json](../apps/web/test-results/live-2026-10-13/stage-045-current-business-staff-guard.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-171

employee statistics exclude material receipts from turnover and payout percentages

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-171); сохранённый диапазон строк 345–353; SHA-256 фрагмента: b5c80ef83aba4a1684463405c0ad344af19b061951f5529be903598b7c827900.
- [Архивный снимок карточки 33](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [finance-money-verified.json](../apps/web/test-results/live-2026-10-13/finance-money-verified.json), [stage-046-hourly-finance.json](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-172

hourly guarantee is presented as the top-up and obscures the original base

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-172); сохранённый диапазон строк 336–344; SHA-256 фрагмента: 1cffe0afdd9eb09f0c4c4371b14062342446175bd51d7556b08a26f34396443c.
- [Архивный снимок карточки 32](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-046-hourly-finance.json](../apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-173

package sale terms stay Russian under English and Kyrgyz UI

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-173); сохранённый диапазон строк 328–335; SHA-256 фрагмента: bc9376b05910b78c984f39994e98ff5ffc4c4d385dd350596a3761c282f9af8a.
- [Архивный снимок карточки 31](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-049-package-sale-copy.json](../apps/web/test-results/live-2026-10-13/stage-049-package-sale-copy.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-174

global super-admin diagnostic pages wrongly require tenant membership

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-174); сохранённый диапазон строк 320–327; SHA-256 фрагмента: 7d55ae92800153f16092d011d91063596091c8c91dba4e7cdaa92adc07344a5e.
- [Архивный снимок карточки 30](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [admin-clients-after.json](../apps/web/test-results/live-2026-10-13/admin-clients-after.json), [admin-diagnostics-before.json](../apps/web/test-results/live-2026-10-13/admin-diagnostics-before.json), [stage-050-admin-readonly.json](../apps/web/test-results/live-2026-10-13/stage-050-admin-readonly.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-175

diagnostic clients call nonexistent administrative API paths

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-175); сохранённый диапазон строк 312–319; SHA-256 фрагмента: ffe43f739e4032c79e0fad8fd8120d712d2e2eab7e8a67780cd778104cf5f53e.
- [Архивный снимок карточки 29](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-050-admin-readonly.json](../apps/web/test-results/live-2026-10-13/stage-050-admin-readonly.json), [stage-051-admin-api-boundary.json](../apps/web/test-results/live-2026-10-13/stage-051-admin-api-boundary.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-176

administrative monitoring text is mojibake

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-176); сохранённый диапазон строк 304–311; SHA-256 фрагмента: 371ad238fc5f26c0bf8d156402f7098e50c438b27a7bd86e8bd0efd817de855c.
- [Архивный снимок карточки 28](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-050-admin-readonly.json](../apps/web/test-results/live-2026-10-13/stage-050-admin-readonly.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-177

monitoring statistics fail with a nested PostgreSQL aggregate

- Уровень: P1; состояние: **Исторически open/reopened**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-177); сохранённый диапазон строк 297–303; SHA-256 фрагмента: 6027bc9ec6bc753f94f2fe59b18a521ca35af620bed2c8ce22db22f2e9ed624c.
- [Архивный снимок карточки 27](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-050-admin-readonly.json](../apps/web/test-results/live-2026-10-13/stage-050-admin-readonly.json), [stage-051-admin-api-boundary.json](../apps/web/test-results/live-2026-10-13/stage-051-admin-api-boundary.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-178

blank staff-user lookup exposes the platform account directory

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-178); сохранённый диапазон строк 286–296; SHA-256 фрагмента: af922913aff520373fe9204be905791d11e5636b584482606de90e8a91355e21.
- [Архивный снимок карточки 26](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G004-empty-search-before.json](../apps/web/test-results/global-2026-10-14/stage-G004-empty-search-before.json), [stage-G004-empty-search-after.json](../apps/web/test-results/global-2026-10-14/stage-G004-empty-search-after.json), [empty-search-after.json](../apps/web/test-results/global-2026-10-14/empty-search-after.json), [empty-search-before.json](../apps/web/test-results/global-2026-10-14/empty-search-before.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-179

hidden services disappear from owner management and lose saved branch selection

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-179); сохранённый диапазон строк 276–285; SHA-256 фрагмента: b48f0c90222b093c4f02f6b86d9dd5daf8a2e9d1f5e73993c990d71eafadf9af.
- [Архивный снимок карточки 25](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G005-service-lifecycle-before.json](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-before.json), [stage-G005-service-lifecycle-after.json](../apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-after.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-180

public business landing uses Russian fallback copy on EN/KY

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-180); сохранённый диапазон строк 266–275; SHA-256 фрагмента: 51d7cd9af4ea9edb87fa4f630966fa62be3fe593c4adf8cf0b2b44f018dfc6d1.
- [Архивный снимок карточки 24](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G006-public-copy-before.json](../apps/web/test-results/global-2026-10-14/stage-G006-public-copy-before.json), [stage-G006-public-copy-after.json](../apps/web/test-results/global-2026-10-14/stage-G006-public-copy-after.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-181

manual staff-add safety guidance stays Russian and lookup hint has double parentheses

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-181); сохранённый диапазон строк 256–265; SHA-256 фрагмента: d6541af880b34ff4ad645a916d25d4af09757a80bbb967a712932e417baeb855.
- [Архивный снимок карточки 23](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G007-staff-guidance-before.json](../apps/web/test-results/global-2026-10-14/stage-G007-staff-guidance-before.json), [stage-G007-staff-guidance-after.json](../apps/web/test-results/global-2026-10-14/stage-G007-staff-guidance-after.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-182

Kyrgyz booking receipt formats date in Russian

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-182); сохранённый диапазон строк 240–255; SHA-256 фрагмента: b3ccdab709e3b466b2d9c43e49fec3e36b24ae8ca369f20f3a9d994fc9859fea.
- [Архивный снимок карточки 22](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G014-card-date-before.json](../apps/web/test-results/global-2026-10-14/stage-G014-card-date-before.json), [stage-G038-calendar-ky-before.json](../apps/web/test-results/global-2026-10-15/stage-G038-calendar-ky-before.json), [stage-G130-branch-weekdays-after.json](../apps/web/test-results/global-2026-10-17/stage-G130-branch-weekdays-after.json), [receipt-ky-after.jpg](../apps/web/test-results/global-2026-10-14/receipt-ky-after.jpg), [stage-G014-card-date-after.json](../apps/web/test-results/global-2026-10-14/stage-G014-card-date-after.json), [stage-G019-schedule-weekdays-before.json](../apps/web/test-results/global-2026-10-14/stage-G019-schedule-weekdays-before.json), [stage-G019-schedule-weekdays-after.json](../apps/web/test-results/global-2026-10-14/stage-G019-schedule-weekdays-after.json), [stage-G038-calendar-ky-after.json](../apps/web/test-results/global-2026-10-15/stage-G038-calendar-ky-after.json), [calendar-ky-after.png](../apps/web/test-results/global-2026-10-15/calendar-ky-after.png), [card-date-after.json](../apps/web/test-results/global-2026-10-14/card-date-after.json), [card-date-before.json](../apps/web/test-results/global-2026-10-14/card-date-before.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-183

own bookings ARIA tabs lack keyboard navigation

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-183); сохранённый диапазон строк 229–239; SHA-256 фрагмента: eb3ff61e3a65f4c63a6d896e8b73948fba61c6ed07da88738db3a676cf665c36.
- [Архивный снимок карточки 21](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G013-tabs-before.json](../apps/web/test-results/global-2026-10-14/stage-G013-tabs-before.json), [stage-G013-tabs-after.json](../apps/web/test-results/global-2026-10-14/stage-G013-tabs-after.json), [tabs-after.json](../apps/web/test-results/global-2026-10-14/tabs-after.json), [tabs-before.json](../apps/web/test-results/global-2026-10-14/tabs-before.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-184

header retains old account's cabinet options after cross-tab login

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-184); сохранённый диапазон строк 219–228; SHA-256 фрагмента: 8b61f27a224f446e609e0bf1890ddfa3c0bdaa43c210f4a506a8b521e3e93c58.
- [Архивный снимок карточки 20](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G016-role-menu-before.json](../apps/web/test-results/global-2026-10-14/stage-G016-role-menu-before.json), [stage-G016-role-menu-after.json](../apps/web/test-results/global-2026-10-14/stage-G016-role-menu-after.json), [role-menu-after.jpg](../apps/web/test-results/global-2026-10-14/role-menu-after.jpg), [role-menu-after.json](../apps/web/test-results/global-2026-10-14/role-menu-after.json), [role-menu-before.json](../apps/web/test-results/global-2026-10-14/role-menu-before.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-185

loaded schedule draft status keeps previous language after switch

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-185); сохранённый диапазон строк 210–218; SHA-256 фрагмента: 82582d66b1940377aed0b680a6db5a97062cff3e2ec8b83585ab94345b9c0119.
- [Архивный снимок карточки 19](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G020-schedule-notice-before.json](../apps/web/test-results/global-2026-10-14/stage-G020-schedule-notice-before.json), [stage-G020-schedule-notice-after.json](../apps/web/test-results/global-2026-10-14/stage-G020-schedule-notice-after.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-186

ordinary comma in catalogue search breaks the filter

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-186); сохранённый диапазон строк 201–209; SHA-256 фрагмента: 1569bebdfcaadc9e48b8ec7e50cd46ae1cc0f2a1af55a450b95cca08dd01d908.
- [Архивный снимок карточки 18](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G027-catalog-punctuation-before.json](../apps/web/test-results/global-2026-10-14/stage-G027-catalog-punctuation-before.json), [stage-G027-catalog-punctuation-after.json](../apps/web/test-results/global-2026-10-14/stage-G027-catalog-punctuation-after.json).
- Граница: Only the exact historical source scenario. No current release, whole-area, all-role, device or security certification. See original limits and follow-ups.

## WB-187

public section counters always use plural nouns

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-187); сохранённый диапазон строк 189–200; SHA-256 фрагмента: 053494896ca2abeb5f122650babada536658fee7c1a6d6cd0fb1b7ea9165810a.
- [Архивный снимок карточки 17](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G098-finance-status-counts-after.json](../apps/web/test-results/global-2026-10-16/stage-G098-finance-status-counts-after.json), [stage-G096-finance-counts-after.json](../apps/web/test-results/global-2026-10-16/stage-G096-finance-counts-after.json), [stage-G032-counts-before.json](../apps/web/test-results/global-2026-10-15/stage-G032-counts-before.json), [stage-G067-home-counts-after.json](../apps/web/test-results/global-2026-10-15/stage-G067-home-counts-after.json), [counts-before-tests.json](../apps/web/test-results/global-2026-10-15/counts-before-tests.json), [stage-G032-counts-after.json](../apps/web/test-results/global-2026-10-15/stage-G032-counts-after.json), [counts-after.png](../apps/web/test-results/global-2026-10-15/counts-after.png).
- Граница: Все числа, все экраны и весь перевод.

## WB-188

changing booking branch keeps an unavailable staff selection

- Уровень: P1; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-188); сохранённый диапазон строк 179–188; SHA-256 фрагмента: aa61084b2dfc87157751f8ed842303581db98645900eece5f4a3e26a778813fd.
- [Архивный снимок карточки 16](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G036-branch-reset-before.json](../apps/web/test-results/global-2026-10-15/stage-G036-branch-reset-before.json), [stage-G036-branch-reset-after.json](../apps/web/test-results/global-2026-10-15/stage-G036-branch-reset-after.json), [branch-reset-after.png](../apps/web/test-results/global-2026-10-15/branch-reset-after.png).
- Граница: Серверные права и создание брони.

## WB-189

early booking wizard guidance and calendar captions stay Russian

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-189); сохранённый диапазон строк 169–178; SHA-256 фрагмента: d94d120b85b1a8fe3bc2b51634b1efaaf52e6c41acf25a3d3a2dfd5afc6c0c86.
- [Архивный снимок карточки 15](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G037-early-copy-before.json](../apps/web/test-results/global-2026-10-15/stage-G037-early-copy-before.json), [stage-G063-empty-title-after.json](../apps/web/test-results/global-2026-10-15/stage-G063-empty-title-after.json), [stage-G037-early-copy-after.json](../apps/web/test-results/global-2026-10-15/stage-G037-early-copy-after.json), [early-copy-after.png](../apps/web/test-results/global-2026-10-15/early-copy-after.png).
- Граница: Весь мастер записи и все ошибки.

## WB-190

booking specialist choice ignores the published off-day

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-190); сохранённый диапазон строк 156–168; SHA-256 фрагмента: 9c587e2362494a1f5b446465688df58a1a446b58d44e428323852bdeca42cac7.
- [Архивный снимок карточки 14](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G062-staff-day-availability-after.json](../apps/web/test-results/global-2026-10-15/stage-G062-staff-day-availability-after.json), [stage-G039-date-availability.json](../apps/web/test-results/global-2026-10-15/stage-G039-date-availability.json), [stage-G077-repeat-offday-after.json](../apps/web/test-results/global-2026-10-15/stage-G077-repeat-offday-after.json), [stage-G077-repeat-offday-before.json](../apps/web/test-results/global-2026-10-15/stage-G077-repeat-offday-before.json).
- Граница: Все переводы, отсутствия, legacy-режимы и права RPC.

## WB-191

selection summary drops the chosen any-master mode

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-191); сохранённый диапазон строк 147–155; SHA-256 фрагмента: 839ef8fac4506d8ba0a2d3c32f5e3cec77993e2cf5a5f7b96e7aa06cd8f2b66a.
- [Архивный снимок карточки 13](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G069-any-master-summary-before.json](../apps/web/test-results/global-2026-10-15/stage-G069-any-master-summary-before.json), [stage-G069-any-master-summary-after.json](../apps/web/test-results/global-2026-10-15/stage-G069-any-master-summary-after.json).
- Граница: Подбор и создание конечной брони.

## WB-192

booking map overlay leaks keyboard focus to background actions

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-192); сохранённый диапазон строк 137–146; SHA-256 фрагмента: a430a7fa305f2a2c483e94291567c6dea9228dccb35e0a21e1ec02411817dac4.
- [Архивный снимок карточки 12](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G070-map-dialog-before.json](../apps/web/test-results/global-2026-10-15/stage-G070-map-dialog-before.json), [stage-G070-map-dialog-after.json](../apps/web/test-results/global-2026-10-15/stage-G070-map-dialog-after.json), [stage-G074-review-dialog-after.json](../apps/web/test-results/global-2026-10-15/stage-G074-review-dialog-after.json), [stage-G074-review-dialog-before.json](../apps/web/test-results/global-2026-10-15/stage-G074-review-dialog-before.json).
- Граница: Карта провайдера, screen reader и реальные мобильные размеры.

## WB-193

switching profile language silently replaces unsaved fields

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-193); сохранённый диапазон строк 128–136; SHA-256 фрагмента: f456d2f04f71027d160cd656c21a27b0b1ac1db88a34b190144456d50a705350.
- [Архивный снимок карточки 11](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G071-profile-draft-before.json](../apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-before.json), [stage-G071-profile-draft-after.json](../apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-after.json).
- Граница: Сохранение на сервере, смена личности и ошибки сети.

## WB-194

booking cancellation confirmation uses identical labels for opposite actions

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-194); сохранённый диапазон строк 119–127; SHA-256 фрагмента: ea093aff6b434e3cb2fa9109659d0dec69163401b227b3794e28b556f7221860.
- [Архивный снимок карточки 10](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G075-cancel-labels-before.json](../apps/web/test-results/global-2026-10-15/stage-G075-cancel-labels-before.json), [stage-G075-cancel-labels-after.json](../apps/web/test-results/global-2026-10-15/stage-G075-cancel-labels-after.json).
- Граница: Фактическая отмена и её финансовые эффекты.

## WB-195

existing-session redirect leaves stale signed-out server UI

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-195); сохранённый диапазон строк 111–118; SHA-256 фрагмента: 6dd9208669fd4213635cab7262f17982f5674f33049bd1e7333c7f1d8a442a30.
- [Архивный снимок карточки 9](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G076-existing-session-after.json](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-after.json), [stage-G076-existing-session-before.json](../apps/web/test-results/global-2026-10-15/stage-G076-existing-session-before.json).
- Граница: Все провайдеры, истечение сессии и причина сетевого сбоя.

## WB-196

Escape from cabinet menu item loses keyboard focus

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-196); сохранённый диапазон строк 103–110; SHA-256 фрагмента: e28fdcb58c046c0ca225556d2cc7516f9c8aad3baaaff1cade8a6f5616271f3c.
- [Архивный снимок карточки 8](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G078-role-menu-after.json](../apps/web/test-results/global-2026-10-15/stage-G078-role-menu-after.json), [stage-G078-role-menu-before.json](../apps/web/test-results/global-2026-10-15/stage-G078-role-menu-before.json).
- Граница: Права роли и доступность всего сайта.

## WB-197

Past restored day incorrectly allows the next booking step

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-197); сохранённый диапазон строк 93–102; SHA-256 фрагмента: 56c51b0ba5a4f802f4edb0867189c1e1c8aef30896ba425292e77b9eabb91762.
- [Архивный снимок карточки 7](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G088-day-range-after.json](../apps/web/test-results/global-2026-10-16/stage-G088-day-range-after.json), [g088-past-day-blocked-ru.jpg](../apps/web/test-results/global-2026-10-16/g088-past-day-blocked-ru.jpg).
- Граница: Защита прямой серверной команды; полный lint был не зелёный.

## WB-198

Owner calendar accessible control names remain Russian in EN/KY

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-198); сохранённый диапазон строк 82–92; SHA-256 фрагмента: 200233765f53d51a1f09d1c3bf0a94bc697e45e0ed486c46719f259416ef372f.
- [Архивный снимок карточки 6](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G102-calendar-tooltip-after.json](../apps/web/test-results/global-2026-10-16/stage-G102-calendar-tooltip-after.json), [stage-G101-owner-calendar-labels-after.json](../apps/web/test-results/global-2026-10-16/stage-G101-owner-calendar-labels-after.json), [g101-calendar-en-after.jpg](../apps/web/test-results/global-2026-10-16/g101-calendar-en-after.jpg).
- Граница: Весь календарь, screen reader и полный перевод.

## WB-199

Calendar loses selected day and branch after opening a receipt

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-199); сохранённый диапазон строк 69–81; SHA-256 фрагмента: 09bab3e4916523953bdddb63b46fb5149f24fedd60e5985a661ab71d9654784c.
- [Архивный снимок карточки 5](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G106-calendar-context-after.json](../apps/web/test-results/global-2026-10-17/stage-G106-calendar-context-after.json), [stage-G117-finance-view-context-after.json](../apps/web/test-results/global-2026-10-17/stage-G117-finance-view-context-after.json), [stage-G114-staff-history-context-after.json](../apps/web/test-results/global-2026-10-17/stage-G114-staff-history-context-after.json), [g106-calendar-after.jpg](../apps/web/test-results/global-2026-10-17/g106-calendar-after.jpg).
- Граница: Любой переход, SSR без промежуточного состояния и чужой бизнес.

## WB-200

Authenticated booking step asks the current client to sign in again

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-200); сохранённый диапазон строк 60–68; SHA-256 фрагмента: f9e7009118cb79748bf5a9c1170961a4dc2f741c2a1d0746d02060deff74fac6.
- [Архивный снимок карточки 4](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G110-step5-auth-guidance-after.json](../apps/web/test-results/global-2026-10-17/stage-G110-step5-auth-guidance-after.json).
- Граница: Гостевой живой сценарий и отправка брони.

## WB-201

Staff statistics deduct the hourly top-up twice from a closed business share

- Уровень: P0 (incorrect financial aggregate); состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-201); сохранённый диапазон строк 51–59; SHA-256 фрагмента: 09fb1b0669f6f2bb8f93e80cbcde055bb983dc30166a0bb15dcad560988c0e52.
- [Архивный снимок карточки 3](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G116-closed-stats-topup-after.json](../apps/web/test-results/global-2026-10-17/stage-G116-closed-stats-topup-after.json).
- Граница: Полная финансовая модель, округление, гарантия сверх поступлений. Старый coverage FAIL сохранён.

## WB-202

Profile first paint advertises an empty unlinked identity before data loads

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-202); сохранённый диапазон строк 41–50; SHA-256 фрагмента: 8f9f2f1ebe25fc6f75586101ff158679db55238e8cf49f29781a37d3d1583f2e.
- [Архивный снимок карточки 2](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G123-profile-initial-loading-after.json](../apps/web/test-results/global-2026-10-17/stage-G123-profile-initial-loading-after.json).
- Граница: Ошибка загрузки и смена личности. G141 содержит 3 красные UNIT-проверки; старый lint FAIL открыт.

## WB-203

Business contact settings ignore EN/KY locale

- Уровень: P2; состояние: **Исторический узкий SAME-LIVE**.
- [Точная исходная карточка](./WEB_BUG_REGISTRY.md#wb-203); сохранённый диапазон строк 32–40; SHA-256 фрагмента: 226a770945927003dd9d8fce62478c4ce247aafc9abcbabc2e90dba48eb96240.
- [Архивный снимок карточки 1](./verification/records.jsonl) содержит полный текст, включая ограничения.
- Прямо названные найденные доказательства: [stage-G129-business-contact-settings-locale-after.json](../apps/web/test-results/global-2026-10-17/stage-G129-business-contact-settings-locale-after.json).
- Граница: Save, серверная валидация, права API, вся адаптивность.
