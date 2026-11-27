# Политика конфиденциальности Kezek — черновик

Статус: проект решения — черновик для юриста, 28 ноября 2026. Задачи R25-23 и R25-24 из [ревью 2026-11-25](../PROJECT_REVIEW_2026-11-25.md) и [списка действий владельца](../OWNER_ACTIONS.md).

> **Перед публикацией текст должен проверить юрист.** Это не юридическая консультация. Черновик описывает, что делает код Kezek на 28 ноября 2026 года. Квадратные скобки — данные, которые даёт владелец или юрист. Живые страницы `/privacy` и `/data-deletion` этим файлом не меняются.

Заполнители:

| Заполнитель | Что подставить |
| --- | --- |
| [ДАТА ВСТУПЛЕНИЯ В СИЛУ] | Фиксированная дата, а не дата открытия страницы |
| [ОПЕРАТОР] | Полное имя ИП или название юрлица, которое отвечает за данные |
| [ИНН] | ИНН оператора |
| [АДРЕС] | Юридический адрес оператора |
| [EMAIL ПОДДЕРЖКИ] | Адрес для вопросов о данных и удалении (его требует Google Play) |
| [ТЕЛЕФОН ИЛИ WHATSAPP ПОДДЕРЖКИ] | Необязательно; второй канал поддержки (R25-24) |
| [СРОК ХРАНЕНИЯ] | Срок, который код сейчас не задаёт; решает владелец с юристом |
| [СРОК ОТВЕТА] | За сколько дней вы отвечаете на запрос о данных |
| [ВОЗРАСТ] | С какого возраста можно пользоваться сервисом без родителей |

---

## Русская версия

**Политика конфиденциальности Kezek**

Действует с [ДАТА ВСТУПЛЕНИЯ В СИЛУ].

### 1. Кто мы

Kezek — сервис онлайн-записи в салоны красоты и барбершопы. Он работает на сайте kezek.vercel.app и в мобильном приложении для iOS и Android.

За обработку ваших данных отвечает [ОПЕРАТОР], ИНН [ИНН], адрес: [АДРЕС]. Связаться с нами: [EMAIL ПОДДЕРЖКИ].

Мы обрабатываем данные по законодательству Кыргызской Республики, в том числе по Закону КР «Об информации персонального характера».

### 2. Коротко

- Мы собираем только то, что нужно для записи, входа и уведомлений.
- Ваши данные для записи получает салон, в который вы записались.
- Мы не продаём данные и не показываем рекламу. Сторонней рекламной или аналитической слежки в Kezek нет.
- Оплаты через Kezek нет. Мы не получаем данные банковских карт.
- Аккаунт можно удалить в профиле на сайте или в приложении. Есть 7 дней, чтобы передумать.

### 3. Какие данные мы получаем

**Вход и аккаунт.** Вы входите через Google, Яндекс, Telegram или WhatsApp. На iPhone есть вход через Apple. От сервиса входа мы получаем идентификатор аккаунта и то, что он передаёт: имя, e-mail, у Telegram — имя пользователя и ссылку на фото, у Яндекса — логин. Apple может передать скрытый e-mail вместо настоящего. При входе через WhatsApp мы отправляем код на ваш номер и сохраняем номер.

**Профиль.** Имя, телефон, e-mail, язык интерфейса, какие уведомления вы хотите получать, привязанные Telegram и WhatsApp.

**Записи.** Салон, филиал, мастер, услуги, дата и время, статус записи. В записи сохраняются ваше имя, телефон и e-mail, чтобы салон мог с вами связаться.

**Запись без аккаунта (гостевая).** Имя, телефон и, если укажете, e-mail. Эти данные получает салон.

**Отзывы.** Оценка и комментарий к визиту.

**Уведомления.** Чтобы прислать подтверждение, отмену или напоминание, мы используем ваш e-mail, Telegram, номер WhatsApp или push-токен приложения. Если вы ответите в WhatsApp «отмена» или «подтвердить», мы получим текст ответа.

**Push-уведомления.** Если вы включите их в профиле приложения, мы сохраним токен устройства и тип системы (iOS или Android). Не больше 10 устройств на аккаунт.

**Местоположение.** Только если вы разрешите. Приложение и страница карты на сайте берут координаты устройства, чтобы показать ближайшие филиалы. Координаты уходят на наш сервер в запросе поиска и нужны только для расчёта расстояния. Мы их не сохраняем. Владелец бизнеса может отметить точку филиала на карте — это адрес филиала, а не ваши данные.

**Мастера и сотрудники.** Имя, телефон, e-mail, фото, расписание, смены, услуги, выручка и выплаты по сменам. Эти данные вносит бизнес или сам мастер. Фото мастера видно всем на странице салона. При действиях со сменой и кассой мы записываем IP-адрес и тип браузера или приложения — для защиты от ошибок и злоупотреблений.

**Заявка на подключение бизнеса.** Имя, название бизнеса, телефон, e-mail, категория, комментарий, ссылки на страницы бизнеса.

**Технические данные.**
- Отчёты об ошибках (Sentry): текст ошибки, экран или адрес страницы без личных параметров, тип устройства и браузера, идентификатор аккаунта. IP-адрес, cookies, тела запросов, e-mail и телефоны из текста удаляются до отправки.
- Наша собственная статистика: просмотр главной, страницы салона, шаги записи. Сохраняются тип события, салон, филиал, случайный идентификатор сеанса, платформа, на сайте — тип браузера и страница, с которой вы пришли. Если вы вошли, к событию приложения или сайта может быть привязан идентификатор аккаунта. Это не передаётся сторонним сервисам аналитики.
- IP-адрес на короткое время используется, чтобы ограничить слишком частые запросы.

### 4. Cookies и данные на устройстве

Сервис использует только необходимые cookies. Аналитических и рекламных cookies нет.

| Cookie | Зачем | Срок |
| --- | --- | --- |
| Cookies входа Supabase (`sb-…`) | Держать вас в аккаунте | Пока действует сессия |
| `kezek_lang` | Запомнить язык | 1 год |
| `kezek_preferred_cabinet` | Какой кабинет открывать | 1 год |
| `kezek_staff_id` | Какую карточку мастера показывать, если их несколько | До выхода |
| `kezek_yandex_*`, `__Host-kezek-telegram-login` | Защита входа через Яндекс и Telegram | Несколько минут |

Сайт также хранит в браузере (localStorage, sessionStorage) язык, выбранные шаги записи перед входом и случайный номер сеанса статистики. Приложение хранит сессию, язык и черновики записей в защищённом хранилище телефона.

На страницах с картой загружаются Яндекс Карты, на странице входа — кнопка Telegram. Эти сервисы получают ваш IP-адрес по своим правилам.

### 5. Зачем мы используем данные

- Создать аккаунт и пустить вас в него.
- Оформить, перенести и отменить запись.
- Прислать подтверждение, отмену и напоминания за 24 часа и за 2 часа до визита.
- Показать ближайшие филиалы.
- Учитывать отзывы в рейтинге мастеров и филиалов.
- Вести смены и учёт для бизнеса.
- Находить и исправлять ошибки, защищать сервис от злоупотреблений.
- Выполнять требования закона.

Основания обработки: ваше согласие и выполнение услуги, о которой вы просите. [ОСНОВАНИЯ — уточнит юрист.]

### 6. Кому мы передаём данные

**Салону, в который вы записались.** Владелец, управляющие, администраторы филиала и ваш мастер видят запись: ваше имя, телефон, e-mail, услуги, время, статус, отзыв к визиту. Салон сам отвечает за то, как использует эти данные.

**Сервисам, которые помогают Kezek работать:**

| Сервис | Что делает | Какие данные |
| --- | --- | --- |
| Supabase | База данных, вход, хранение фото мастеров | Все данные сервиса |
| Vercel | Хостинг сайта и API | Запросы к сайту, технические журналы |
| Resend | Отправка писем | E-mail, текст письма, файл для календаря |
| Meta (WhatsApp Business) | Коды входа, уведомления, ответы на них | Номер телефона, текст сообщения |
| Telegram | Вход, уведомления | Telegram ID, текст сообщения |
| Expo, Google (FCM), Apple (APNs) | Push-уведомления | Токен устройства, текст уведомления |
| Sentry | Отчёты об ошибках | См. раздел 3, без IP |
| Upstash | Ограничение частоты запросов | IP-адрес или идентификатор аккаунта, на короткое время |
| Google, Яндекс, Apple, Telegram, WhatsApp | Вход в аккаунт | Данные, которые вы разрешили передать |
| Яндекс Карты | Карта филиалов | IP-адрес, область карты |

**Государственным органам** — только по законному требованию.

Мы не продаём данные и не передаём их для рекламы.

### 7. Где хранятся данные

База данных Supabase находится в Европейском союзе (Швеция). Сервисы из раздела 6 могут обрабатывать данные в других странах, в том числе в США. Это трансграничная передача данных. [Условия трансграничной передачи — уточнит юрист.]

### 8. Сколько мы храним данные

| Данные | Срок |
| --- | --- |
| Аккаунт и профиль | Пока аккаунт есть. После запроса на удаление — 7 дней, затем удаляются |
| Профиль без входов и записей 3 года | Имя и телефон заменяются на «Anonymized». E-mail для входа остаётся. Не касается владельцев, мастеров и сотрудников бизнеса |
| Ваши имя, телефон и e-mail в записях | 7 лет с даты визита, затем удаляются. Сама запись остаётся у салона без личных данных |
| Отзывы | Пока есть аккаунт |
| Коды входа через WhatsApp, попытки входа через Telegram | 24 часа |
| Адрес, номер, push-токен и текст в очереди уведомлений | 30 дней |
| Входящие сообщения WhatsApp | 30 дней, затем остаётся только служебная отметка без текста |
| Шаги записи на сайте (статистика воронки) | 400 дней |
| События статистики просмотров | [СРОК ХРАНЕНИЯ] — код их сейчас не удаляет |
| Журналы запросов мастеров со сменой и кассой (с IP) | 90 дней |
| Журнал финансовых операций смен (с IP) | 365 дней |
| Карточка мастера и учёт смен после ухода мастера | [СРОК ХРАНЕНИЯ] |
| Заявки на подключение бизнеса | [СРОК ХРАНЕНИЯ] |
| Отчёты об ошибках в Sentry | [СРОК ХРАНЕНИЯ] — задаётся тарифом Sentry |
| Журналы хостинга и входа (Vercel, Supabase) | [СРОК ХРАНЕНИЯ] — задаётся этими сервисами |
| Резервные копии | [СРОК ХРАНЕНИЯ] |

### 9. Как удалить аккаунт

На сайте: «Личный кабинет» → «Профиль» → «Удаление аккаунта». В приложении: «Профиль» → «Удаление аккаунта». Введите слово УДАЛИТЬ и подтвердите.

- Удаление наступит через 7 дней. До этого его можно отменить там же.
- На эти 7 дней уведомления по e-mail, в Telegram и WhatsApp выключаются. При отмене удаления они возвращаются.
- Удалить аккаунт сразу нельзя, если вы владелец бизнеса, у вас есть карточка мастера или роль в бизнесе, или у вас есть будущие записи. Сначала передайте бизнес, попросите убрать вашу роль или карточку, отмените или завершите записи. Если такое условие появится в течение 7 дней, удаление не выполнится. Тогда устраните причину и запросите удаление снова.

Что удаляется: профиль, способы входа, отзывы, push-токены, роли, пакеты визитов и история использования акций.

Что остаётся: записи остаются у салона для его учёта, но вместо имени стоит «Удалённый пользователь», а телефон и e-mail стираются. Остаются записи статистики с прежним идентификатором аккаунта (без имени и контактов), журналы и резервные копии на сроки из раздела 8.

Важно: неиспользованные визиты из пакета, который вы купили в салоне, пропадут вместе с аккаунтом. Обсудите это с салоном до удаления.

Если вы записывались без аккаунта или не можете войти, напишите на [EMAIL ПОДДЕРЖКИ]. Укажите номер телефона или e-mail из записи. Мы ответим в течение [СРОК ОТВЕТА] дней.

### 10. Ваши права

Вы можете:
- узнать, какие данные о вас есть;
- исправить имя, телефон и e-mail в профиле;
- выключить уведомления по каналам в профиле, push — в профиле приложения;
- отозвать согласие и удалить аккаунт;
- пожаловаться в уполномоченный орган Кыргызской Республики по защите персональных данных.

Пишите на [EMAIL ПОДДЕРЖКИ]. Мы ответим в течение [СРОК ОТВЕТА] дней.

### 11. Как мы защищаем данные

- Все соединения идут по HTTPS.
- Доступ к данным ограничен правилами базы данных: клиент видит свои записи, салон — записи своего бизнеса, мастер — свои.
- Сессия в приложении хранится в защищённом хранилище телефона.
- Отчёты об ошибках очищаются от личных данных до отправки.

### 12. Дети

Сервис не предназначен для детей младше [ВОЗРАСТ] лет без согласия родителей.

### 13. Изменения политики

Мы публикуем новую версию на этой странице с новой датой вступления в силу. О существенных изменениях мы сообщим на сайте и в приложении.

### 14. Контакты

[ОПЕРАТОР], [АДРЕС]. E-mail: [EMAIL ПОДДЕРЖКИ]. [ТЕЛЕФОН ИЛИ WHATSAPP ПОДДЕРЖКИ].

---

## Кыргызча

> **Кыргыз тилин эне тили болгон адам текшериши керек.** Котормо орусча текст менен бирдей маанини берет. Мыйзамдын аталышын юрист текшерсин.

**Kezek купуялык саясаты**

[ДАТА ВСТУПЛЕНИЯ В СИЛУ] күнүнөн тартып күчүнө кирет.

### 1. Биз кимбиз

Kezek — сулуулук салондоруна жана барбершопторго онлайн жазылуу кызматы. Ал kezek.vercel.app сайтында жана iOS, Android үчүн мобилдик тиркемеде иштейт.

Маалыматтарыңыз үчүн [ОПЕРАТОР] жооп берет, ИНН [ИНН], дареги: [АДРЕС]. Байланыш: [EMAIL ПОДДЕРЖКИ].

Маалыматтарды Кыргыз Республикасынын мыйзамдарына, анын ичинде «Жеке мүнөздөгү маалымат жөнүндө» Мыйзамына ылайык иштетебиз.

### 2. Кыскача

- Жазылуу, кирүү жана билдирүүлөр үчүн керектүү гана маалыматты чогултабыз.
- Жазылуу маалыматыңызды сиз жазылган салон алат.
- Маалыматты сатпайбыз, жарнама көрсөтпөйбүз. Kezekте үчүнчү тараптын жарнамалык же аналитикалык көзөмөлү жок.
- Kezek аркылуу төлөм жок. Банк карталарынын маалыматын албайбыз.
- Аккаунтту сайттагы же тиркемедеги профилден өчүрө аласыз. Ойлонуу үчүн 7 күн бар.

### 3. Кандай маалымат алабыз

**Кирүү жана аккаунт.** Google, Яндекс, Telegram же WhatsApp аркылуу киресиз. iPhone'до Apple аркылуу кирүү бар. Кирүү кызматынан аккаунттун идентификаторун жана ал берген маалыматты алабыз: аты, e-mail, Telegram'дан — колдонуучу аты жана сүрөткө шилтеме, Яндекстен — логин. Apple чыныгы e-mail ордуна жашыруун дарек бериши мүмкүн. WhatsApp аркылуу кирүүдө номериңизге код жөнөтүп, номерди сактайбыз.

**Профиль.** Аты, телефон, e-mail, интерфейс тили, кайсы билдирүүлөрдү алгыңыз келет, байланган Telegram жана WhatsApp.

**Жазылуулар.** Салон, филиал, чебер, кызматтар, күнү жана убактысы, жазылуунун абалы. Салон сиз менен байланыша алышы үчүн жазылууда атыңыз, телефонуңуз жана e-mail сакталат.

**Аккаунтсуз (конок) жазылуу.** Аты, телефон жана көрсөтсөңүз — e-mail. Бул маалыматты салон алат.

**Пикирлер.** Барууга берилген баа жана комментарий.

**Билдирүүлөр.** Ырастоо, жокко чыгаруу же эскертүү жөнөтүү үчүн e-mail, Telegram, WhatsApp номери же тиркеменин push-токенин колдонобуз. WhatsApp'та «отмена» же «подтвердить» деп жооп берсеңиз, жооптун текстин алабыз.

**Push-билдирүүлөр.** Аларды тиркеменин профилинде күйгүзсөңүз, түзмөктүн токенин жана системанын түрүн (iOS же Android) сактайбыз. Бир аккаунтка 10 түзмөктөн ашпайт.

**Жайгашкан жер.** Уруксат берсеңиз гана. Тиркеме жана сайттагы карта бети жакынкы филиалдарды көрсөтүү үчүн түзмөктүн координаттарын алат. Координаттар издөө суроосу менен серверге барат жана аралыкты эсептөө үчүн гана керек. Биз аларды сактабайбыз. Бизнес ээси филиалдын чекитин картада белгилей алат — бул филиалдын дареги, сиздин маалымат эмес.

**Чеберлер жана кызматкерлер.** Аты, телефон, e-mail, сүрөт, иш графиги, сменалар, кызматтар, сменалар боюнча киреше жана төлөмдөр. Бул маалыматты бизнес же чебердин өзү киргизет. Чебердин сүрөтү салондун барагында баарына көрүнөт. Смена жана касса менен иштегенде IP-даректи жана браузердин же тиркеменин түрүн жазабыз — ката жана кыянаттыктан коргоо үчүн.

**Бизнести кошууга арыз.** Аты, бизнестин аталышы, телефон, e-mail, категория, комментарий, бизнестин барактарына шилтемелер.

**Техникалык маалымат.**
- Ката отчёттору (Sentry): катанын тексти, жеке параметрлерсиз экран же бет дареги, түзмөк жана браузер түрү, аккаунттун идентификатору. IP-дарек, cookie, суроолордун мазмуну, тексттеги e-mail жана телефондор жөнөтүүдөн мурун өчүрүлөт.
- Өзүбүздүн статистика: башкы бетти, салон барагын көрүү, жазылуу кадамдары. Окуянын түрү, салон, филиал, сеанстын кокус идентификатору, платформа, сайтта — браузердин түрү жана кайсы беттен келгениңиз сакталат. Кирген болсоңуз, окуяга аккаунттун идентификатору байланышы мүмкүн. Бул үчүнчү тараптын аналитика кызматтарына берилбейт.
- IP-дарек өтө тез-тез суроолорду чектөө үчүн кыска убакытка колдонулат.

### 4. Cookie жана түзмөктөгү маалымат

Кызмат зарыл cookie'лерди гана колдонот. Аналитикалык жана жарнамалык cookie жок.

| Cookie | Эмне үчүн | Мөөнөтү |
| --- | --- | --- |
| Supabase кирүү cookie'лери (`sb-…`) | Аккаунтта калтыруу | Сеанс иштеп турганда |
| `kezek_lang` | Тилди эстеп калуу | 1 жыл |
| `kezek_preferred_cabinet` | Кайсы кабинетти ачуу | 1 жыл |
| `kezek_staff_id` | Бир нече болсо, кайсы чебер карточкасын көрсөтүү | Чыкканга чейин |
| `kezek_yandex_*`, `__Host-kezek-telegram-login` | Яндекс жана Telegram аркылуу кирүүнү коргоо | Бир нече мүнөт |

Сайт браузерде (localStorage, sessionStorage) тилди, кирүүдөн мурун тандалган жазылуу кадамдарын жана статистика сеансынын кокус номерин сактайт. Тиркеме сеансты, тилди жана жазылуу долбоорлорун телефондун корголгон сактагычында сактайт.

Карта бар беттерде Яндекс Карталар, кирүү бетинде Telegram баскычы жүктөлөт. Бул кызматтар IP-дарегиңизди өз эрежелери боюнча алышат.

### 5. Маалыматты эмне үчүн колдонобуз

- Аккаунт түзүү жана ага киргизүү.
- Жазылууну түзүү, жылдыруу жана жокко чыгаруу.
- Ырастоо, жокко чыгаруу жана барууга 24 саат жана 2 саат калганда эскертүү жөнөтүү.
- Жакынкы филиалдарды көрсөтүү.
- Пикирлерди чеберлердин жана филиалдардын рейтингинде эсепке алуу.
- Бизнес үчүн сменаларды жана эсепти жүргүзүү.
- Каталарды табуу жана оңдоо, кызматты кыянаттыктан коргоо.
- Мыйзамдын талаптарын аткаруу.

Иштетүүнүн негиздери: сиздин макулдугуңуз жана сиз сураган кызматты аткаруу. [НЕГИЗДЕР — юрист тактайт.]

### 6. Маалыматты кимге беребиз

**Сиз жазылган салонго.** Ээси, башкаруучулар, филиал администраторлору жана чеберициз жазылууну көрөт: атыңыз, телефонуңуз, e-mail, кызматтар, убакыт, абалы, барууга пикир. Бул маалыматты кантип колдонорун салон өзү жооп берет.

**Kezekтин иштешине жардам берген кызматтарга:**

| Кызмат | Эмне кылат | Кандай маалымат |
| --- | --- | --- |
| Supabase | Маалымат базасы, кирүү, чеберлердин сүрөттөрүн сактоо | Кызматтын бардык маалыматы |
| Vercel | Сайт жана API хостинги | Сайтка суроолор, техникалык журналдар |
| Resend | Кат жөнөтүү | E-mail, каттын тексти, календарь файлы |
| Meta (WhatsApp Business) | Кирүү коддору, билдирүүлөр, аларга жооптор | Телефон номери, билдирүүнүн тексти |
| Telegram | Кирүү, билдирүүлөр | Telegram ID, билдирүүнүн тексти |
| Expo, Google (FCM), Apple (APNs) | Push-билдирүүлөр | Түзмөктүн токени, билдирүүнүн тексти |
| Sentry | Ката отчёттору | 3-бөлүмдү караңыз, IP жок |
| Upstash | Суроолордун жыштыгын чектөө | IP-дарек же аккаунттун идентификатору, кыска убакытка |
| Google, Яндекс, Apple, Telegram, WhatsApp | Аккаунтка кирүү | Берүүгө уруксат берген маалыматыңыз |
| Яндекс Карталар | Филиалдардын картасы | IP-дарек, картанын аймагы |

**Мамлекеттик органдарга** — мыйзамдуу талап боюнча гана.

Маалыматты сатпайбыз жана жарнама үчүн бербейбиз.

### 7. Маалымат кайда сакталат

Supabase маалымат базасы Европа Биримдигинде (Швеция) жайгашкан. 6-бөлүмдөгү кызматтар маалыматты башка өлкөлөрдө, анын ичинде АКШда иштетиши мүмкүн. Бул маалыматты чек арадан өткөрүп берүү. [Чек арадан өткөрүү шарттарын юрист тактайт.]

### 8. Маалыматты канча убакыт сактайбыз

| Маалымат | Мөөнөтү |
| --- | --- |
| Аккаунт жана профиль | Аккаунт бар болгончо. Өчүрүүгө суроодон кийин — 7 күн, андан соң өчүрүлөт |
| 3 жыл кирүүсүз жана жазылуусуз профиль | Аты жана телефону «Anonymized» менен алмаштырылат. Кирүү үчүн e-mail калат. Бизнес ээлерине, чеберлерге жана кызматкерлерге тиешелүү эмес |
| Жазылуулардагы атыңыз, телефонуңуз жана e-mail | Баруу күнүнөн 7 жыл, андан соң өчүрүлөт. Жазылуунун өзү салондо жеке маалыматсыз калат |
| Пикирлер | Аккаунт бар болгончо |
| WhatsApp кирүү коддору, Telegram аркылуу кирүү аракеттери | 24 саат |
| Билдирүүлөр кезегиндеги дарек, номер, push-токен жана текст | 30 күн |
| Кирген WhatsApp билдирүүлөрү | 30 күн, андан соң тексти жок кызматтык белги гана калат |
| Сайттагы жазылуу кадамдары (воронка статистикасы) | 400 күн |
| Көрүү статистикасынын окуялары | [СРОК ХРАНЕНИЯ] — код аларды азыр өчүрбөйт |
| Чеберлердин смена жана касса суроолорунун журналдары (IP менен) | 90 күн |
| Сменалардын каржы операцияларынын журналы (IP менен) | 365 күн |
| Чебер кеткенден кийин анын карточкасы жана сменалардын эсеби | [СРОК ХРАНЕНИЯ] |
| Бизнести кошууга арыздар | [СРОК ХРАНЕНИЯ] |
| Sentry'деги ката отчёттору | [СРОК ХРАНЕНИЯ] — Sentry тарифи менен белгиленет |
| Хостинг жана кирүү журналдары (Vercel, Supabase) | [СРОК ХРАНЕНИЯ] — ошол кызматтар белгилейт |
| Резервдик көчүрмөлөр | [СРОК ХРАНЕНИЯ] |

### 9. Аккаунтту кантип өчүрүү керек

Сайтта: «Жеке кабинет» → «Профиль» → «Аккаунтту өчүрүү». Тиркемеде: «Профиль» → «Аккаунтту өчүрүү». ӨЧҮРҮҮ (же УДАЛИТЬ) деген сөздү жазып, ырастаңыз.

- Өчүрүү 7 күндөн кийин болот. Ага чейин ошол эле жерден жокко чыгарса болот.
- Ошол 7 күндө e-mail, Telegram жана WhatsApp билдирүүлөрү өчүрүлөт. Өчүрүүнү жокко чыгарсаңыз, кайра күйөт.
- Эгер сиз бизнестин ээси болсоңуз, чебер карточкаңыз же бизнесте ролуңуз болсо, же келечектеги жазылууларыңыз болсо, аккаунтту азыр өчүрүүгө болбойт. Адегенде бизнести өткөрүп бериңиз, ролуңузду же карточкаңызды алып салууну сураныңыз, жазылууларды жокко чыгарыңыз же аяктаңыз. Мындай шарт 7 күндүн ичинде пайда болсо, өчүрүү аткарылбайт. Анда себебин жоюп, өчүрүүнү кайра сураныңыз.

Эмне өчүрүлөт: профиль, кирүү жолдору, пикирлер, push-токендер, ролдор, баруу пакеттери жана акцияларды колдонуу тарыхы.

Эмне калат: жазылуулар салондун эсеби үчүн калат, бирок аттын ордуна «Удалённый пользователь» турат, телефон жана e-mail өчүрүлөт. Мурунку аккаунт идентификатору менен статистика жазуулары (атсыз жана байланышсыз), журналдар жана резервдик көчүрмөлөр 8-бөлүмдөгү мөөнөттөргө калат.

Маанилүү: салондон сатып алган пакеттеги колдонулбаган барууларыңыз аккаунт менен кошо жоголот. Өчүрүүдөн мурун салон менен сүйлөшүңүз.

Аккаунтсуз жазылган болсоңуз же кире албасаңыз, [EMAIL ПОДДЕРЖКИ] дарегине жазыңыз. Жазылуудагы телефон номерин же e-mail'ди көрсөтүңүз. [СРОК ОТВЕТА] күндүн ичинде жооп беребиз.

### 10. Сиздин укуктарыңыз

Сиз:
- сиз тууралуу кандай маалымат бар экенин биле аласыз;
- профилде атыңызды, телефонуңузду жана e-mail'ди оңдой аласыз;
- профилде билдирүүлөрдү каналдар боюнча, push'ту тиркеменин профилинде өчүрө аласыз;
- макулдугуңузду кайтарып алып, аккаунтту өчүрө аласыз;
- Кыргыз Республикасынын жеке маалыматтарды коргоо боюнча ыйгарым укуктуу органына даттана аласыз.

[EMAIL ПОДДЕРЖКИ] дарегине жазыңыз. [СРОК ОТВЕТА] күндүн ичинде жооп беребиз.

### 11. Маалыматты кантип коргойбуз

- Бардык байланыштар HTTPS аркылуу өтөт.
- Маалыматка жетүү маалымат базасынын эрежелери менен чектелген: кардар өз жазылууларын, салон өз бизнесинин жазылууларын, чебер өзүнүкүн көрөт.
- Тиркемедеги сеанс телефондун корголгон сактагычында сакталат.
- Ката отчёттору жөнөтүүдөн мурун жеке маалыматтан тазаланат.

### 12. Балдар

Кызмат ата-эненин макулдугусуз [ВОЗРАСТ] жашка чейинки балдар үчүн арналган эмес.

### 13. Саясаттын өзгөрүшү

Жаңы версияны ушул бетте жаңы күчүнө кирүү күнү менен жарыялайбыз. Маанилүү өзгөрүүлөр тууралуу сайтта жана тиркемеде кабарлайбыз.

### 14. Байланыш

[ОПЕРАТОР], [АДРЕС]. E-mail: [EMAIL ПОДДЕРЖКИ]. [ТЕЛЕФОН ИЛИ WHATSAPP ПОДДЕРЖКИ].

---

## English

**Kezek Privacy Policy**

Effective from [ДАТА ВСТУПЛЕНИЯ В СИЛУ].

### 1. Who we are

Kezek is an online booking service for beauty salons and barbershops. It runs on kezek.vercel.app and in the mobile app for iOS and Android.

[ОПЕРАТОР], tax ID [ИНН], address: [АДРЕС], is responsible for your data. Contact: [EMAIL ПОДДЕРЖКИ].

We process data under the laws of the Kyrgyz Republic, including the Law "On Personal Information".

### 2. In short

- We collect only what we need for bookings, sign-in and notifications.
- The salon you book with receives your booking details.
- We do not sell data and do not show ads. Kezek has no third-party advertising or analytics tracking.
- There are no payments through Kezek. We never receive bank card details.
- You can delete your account in your profile on the website or in the app. You have 7 days to change your mind.

### 3. What data we receive

**Sign-in and account.** You sign in with Google, Yandex, Telegram or WhatsApp. On iPhone you can also sign in with Apple. The sign-in service gives us your account ID and what it shares: name, e-mail, a Telegram username and photo link, a Yandex login. Apple may give us a private relay address instead of your real e-mail. With WhatsApp sign-in we send a code to your number and keep the number.

**Profile.** Name, phone, e-mail, app language, which notifications you want, linked Telegram and WhatsApp.

**Bookings.** Salon, branch, staff member, services, date and time, booking status. Your name, phone and e-mail are saved with the booking so the salon can reach you.

**Booking without an account (guest).** Name, phone and, if you give it, e-mail. The salon receives this data.

**Reviews.** Your rating and comment for a visit.

**Notifications.** To send a confirmation, cancellation or reminder we use your e-mail, Telegram, WhatsApp number or the app's push token. If you reply "отмена" (cancel) or "подтвердить" (confirm) in WhatsApp, we receive your reply.

**Push notifications.** If you turn them on in the app profile, we keep the device token and system type (iOS or Android). Up to 10 devices per account.

**Location.** Only if you allow it. The app and the map page on the website read the device location to show nearby branches. The coordinates go to our server with the search request and are used only to work out distances. We do not store them. A business owner can mark a branch on the map; that is the branch address, not your data.

**Staff members.** Name, phone, e-mail, photo, schedule, shifts, services, shift revenue and pay. The business or the staff member enters this. A staff member's photo is public on the salon page. When shifts and cash records are changed, we record the IP address and browser or app type to protect against mistakes and abuse.

**Business sign-up request.** Name, business name, phone, e-mail, category, comment, links to the business's pages.

**Technical data.**
- Error reports (Sentry): error text, screen or page address without personal parameters, device and browser type, account ID. IP address, cookies, request bodies, and e-mails and phone numbers in text are removed before sending.
- Our own usage statistics: views of the home page and salon pages, booking steps. We keep the event type, salon, branch, a random session ID, the platform, and on the website the browser type and the page you came from. If you are signed in, an event may be linked to your account ID. None of this goes to third-party analytics.
- Your IP address is used briefly to limit excessive requests.

### 4. Cookies and data on your device

We use only necessary cookies. There are no analytics or advertising cookies.

| Cookie | Purpose | Lifetime |
| --- | --- | --- |
| Supabase sign-in cookies (`sb-…`) | Keep you signed in | While the session lasts |
| `kezek_lang` | Remember your language | 1 year |
| `kezek_preferred_cabinet` | Which workspace to open | 1 year |
| `kezek_staff_id` | Which staff profile to show if you have several | Until you sign out |
| `kezek_yandex_*`, `__Host-kezek-telegram-login` | Protect Yandex and Telegram sign-in | A few minutes |

The website also keeps in your browser (localStorage, sessionStorage) your language, booking choices made before sign-in, and a random statistics session ID. The app keeps your session, language and booking drafts in the phone's secure storage.

Pages with a map load Yandex Maps; the sign-in page loads the Telegram button. These services receive your IP address under their own rules.

### 5. Why we use data

- To create your account and sign you in.
- To make, move and cancel bookings.
- To send confirmations, cancellations and reminders 24 hours and 2 hours before a visit.
- To show nearby branches.
- To count reviews in staff and branch ratings.
- To keep shift and accounting records for the business.
- To find and fix errors and protect the service from abuse.
- To meet legal requirements.

Legal grounds: your consent and providing the service you ask for. [GROUNDS — to be confirmed by a lawyer.]

### 6. Who we share data with

**The salon you book with.** The owner, managers, branch admins and your staff member see the booking: your name, phone, e-mail, services, time, status and your review of the visit. The salon is responsible for how it uses this data.

**Services that help Kezek run:**

| Service | What it does | What data |
| --- | --- | --- |
| Supabase | Database, sign-in, staff photo storage | All service data |
| Vercel | Website and API hosting | Website requests, technical logs |
| Resend | E-mail delivery | E-mail address, message text, calendar file |
| Meta (WhatsApp Business) | Sign-in codes, notifications, replies | Phone number, message text |
| Telegram | Sign-in, notifications | Telegram ID, message text |
| Expo, Google (FCM), Apple (APNs) | Push notifications | Device token, notification text |
| Sentry | Error reports | See section 3, no IP |
| Upstash | Request rate limiting | IP address or account ID, briefly |
| Google, Yandex, Apple, Telegram, WhatsApp | Sign-in | The data you allowed them to share |
| Yandex Maps | Branch map | IP address, map area |

**Public authorities** — only on a lawful request.

We do not sell data or share it for advertising.

### 7. Where data is stored

The Supabase database is in the European Union (Sweden). The services in section 6 may process data in other countries, including the United States. This is a cross-border transfer. [Cross-border transfer terms — to be confirmed by a lawyer.]

### 8. How long we keep data

| Data | Period |
| --- | --- |
| Account and profile | While the account exists. After a deletion request — 7 days, then deleted |
| Profile with no sign-in and no bookings for 3 years | Name and phone are replaced with "Anonymized". The sign-in e-mail stays. Does not apply to business owners, staff or business team members |
| Your name, phone and e-mail in bookings | 7 years from the visit date, then removed. The booking stays with the salon without personal data |
| Reviews | While the account exists |
| WhatsApp sign-in codes, Telegram sign-in attempts | 24 hours |
| Address, number, push token and text in the notification queue | 30 days |
| Incoming WhatsApp messages | 30 days, then only a service marker without text remains |
| Website booking steps (funnel statistics) | 400 days |
| Page view statistics events | [СРОК ХРАНЕНИЯ] — the code does not delete them yet |
| Logs of staff shift and cash requests (with IP) | 90 days |
| Shift finance operations log (with IP) | 365 days |
| A staff profile and shift records after the staff member leaves | [СРОК ХРАНЕНИЯ] |
| Business sign-up requests | [СРОК ХРАНЕНИЯ] |
| Error reports in Sentry | [СРОК ХРАНЕНИЯ] — set by the Sentry plan |
| Hosting and sign-in logs (Vercel, Supabase) | [СРОК ХРАНЕНИЯ] — set by those services |
| Backups | [СРОК ХРАНЕНИЯ] |

### 9. How to delete your account

On the website: "My account" → "Profile" → "Delete account". In the app: "Profile" → "Delete account". Type the word DELETE and confirm.

- Deletion happens after 7 days. Until then you can cancel it in the same place.
- For those 7 days e-mail, Telegram and WhatsApp notifications are off. They come back if you cancel.
- You cannot delete your account yet if you own a business, have a staff profile or a role in a business, or have upcoming bookings. First hand over the business, ask for your role or staff profile to be removed, and cancel or finish your bookings. If such a condition appears within the 7 days, deletion will not run. Remove the reason and request deletion again.

What is deleted: your profile, sign-in methods, reviews, push tokens, roles, visit packages and promotion usage history.

What stays: bookings stay with the salon for its records, but the name becomes "Удалённый пользователь" (deleted user) and the phone and e-mail are erased. Statistics records with the former account ID (no name or contacts), logs and backups stay for the periods in section 8.

Important: unused visits from a package you bought at a salon are lost with the account. Talk to the salon before deleting.

If you booked without an account or cannot sign in, write to [EMAIL ПОДДЕРЖКИ]. Give the phone number or e-mail used for the booking. We reply within [СРОК ОТВЕТА] days.

### 10. Your rights

You can:
- find out what data we hold about you;
- correct your name, phone and e-mail in your profile;
- turn off notifications per channel in your profile, and push in the app profile;
- withdraw consent and delete your account;
- complain to the personal data protection authority of the Kyrgyz Republic.

Write to [EMAIL ПОДДЕРЖКИ]. We reply within [СРОК ОТВЕТА] days.

### 11. How we protect data

- All connections use HTTPS.
- Database rules limit access: a client sees their own bookings, a salon sees its own business's bookings, a staff member sees their own.
- The app keeps your session in the phone's secure storage.
- Error reports are cleaned of personal data before sending.

### 12. Children

The service is not meant for children under [ВОЗРАСТ] without a parent's consent.

### 13. Changes to this policy

We publish a new version on this page with a new effective date. We announce significant changes on the website and in the app.

### 14. Contact

[ОПЕРАТОР], [АДРЕС]. E-mail: [EMAIL ПОДДЕРЖКИ]. [ТЕЛЕФОН ИЛИ WHATSAPP ПОДДЕРЖКИ].

---

## Что изменится при публикации

Когда владелец даст данные и юрист одобрит текст, агенты поменяют:

| Что | Файл или место | Изменение |
| --- | --- | --- |
| Тексты политики и удаления (ru, ky, en) | [legal.ru.ts](../../apps/web/src/app/_components/i18n/dictionaries/legal.ru.ts), [legal.ky.ts](../../apps/web/src/app/_components/i18n/dictionaries/legal.ky.ts), [legal.en.ts](../../apps/web/src/app/_components/i18n/dictionaries/legal.en.ts) | Ключи `legal.privacy.*`, `legal.dataDeletion.*`, `legal.common.*` по этому черновику; новые ключи для обработчиков, сроков, cookies, оператора и контакта |
| Страница `/privacy` | [privacy/page.tsx](../../apps/web/src/app/privacy/page.tsx) | Фиксированная дата вместо `new Date()`; новые разделы (обработчики, хранение, cookies, местоположение, где хранятся данные); оператор и e-mail |
| Страница `/data-deletion` | [data-deletion/page.tsx](../../apps/web/src/app/data-deletion/page.tsx) | Фиксированная дата; реальные шаги и правила удаления (раздел 9); e-mail вместо «формы обратной связи» |
| Подвал сайта | [Footer.tsx](../../apps/web/src/app/_components/Footer.tsx) | Контакт поддержки (R25-24) |
| Ссылки в приложении | [webLinks.ts](../../apps/mobile/src/lib/webLinks.ts), [useProfileScreenData.ts](../../apps/mobile/src/screens/profile/useProfileScreenData.ts) | Пути `/privacy`, `/terms`, `/data-deletion` не меняются; добавить контакт поддержки в профиль приложения (R25-24) |
| App Store Connect | App Privacy, Privacy Policy URL, Support URL | Ответы по разделу 3 и 6; ссылка `https://kezek.vercel.app/privacy` |
| Google Play Console | Data safety, Privacy policy, контактный e-mail, ссылка на удаление аккаунта | Ответы по разделам 3, 6, 9; ссылка `https://kezek.vercel.app/data-deletion` |
| Тексты для сторов | [STORE_LISTINGS.md](../marketing/STORE_LISTINGS.md) | Контакт поддержки |
| Действия владельца | [OWNER_ACTIONS.md](../OWNER_ACTIONS.md) | Отметить R25-23/R25-24 |
| Код удаления данных | [dataRetentionCronService.ts](../../apps/web/src/lib/dataRetentionCronService.ts) | Только если владелец утвердит новые сроки (например для событий статистики) |

### Что должен дать владелец

1. [ОПЕРАТОР] — кто отвечает за данные: ИП или юрлицо, полное имя или название.
2. [ИНН] и [АДРЕС].
3. [EMAIL ПОДДЕРЖКИ] — рабочий ящик, который кто-то читает. По желанию — [ТЕЛЕФОН ИЛИ WHATSAPP ПОДДЕРЖКИ].
4. [ДАТА ВСТУПЛЕНИЯ В СИЛУ].
5. [СРОК ОТВЕТА] на запросы о данных.
6. Решения по срокам [СРОК ХРАНЕНИЯ]: события статистики, карточки ушедших мастеров, заявки бизнесов, Sentry, резервные копии.
7. [ВОЗРАСТ] — минимальный возраст.
8. Юриста, который проверит основания обработки, трансграничную передачу и нужно ли уведомлять уполномоченный орган о начале обработки.
9. Носителя кыргызского языка для проверки перевода.

### Расхождения: живой текст и код

| Живой текст | Что на самом деле |
| --- | --- |
| «Последнее обновление: {date}» показывает сегодняшнюю дату | Нужна фиксированная дата ([privacy/page.tsx](../../apps/web/src/app/privacy/page.tsx), то же в `/terms` и `/data-deletion`) |
| «Для связи используйте форму обратной связи в Сервисе» | Формы обратной связи нет; e-mail нигде не указан |
| Нет оператора, адреса, ИНН | Нужны по закону и для сторов |
| Уведомления «email, SMS»; «отправка SMS через сторонние сервисы» | SMS-канала нет. Каналы: e-mail (Resend), Telegram, WhatsApp (шаблоны Meta), push (Expo) |
| «Компаниям, предоставляющим услуги аналитики» | Сторонней аналитики нет; статистика своя, в нашей базе |
| Аналитические и функциональные cookies | Аналитических cookies нет. Есть только необходимые: вход, язык, выбор кабинета и карточки мастера, защита входа |
| Технические данные «IP-адрес, тип браузера» как общее правило | IP сохраняется только в журналах смен и кассы мастеров (90 и 365 дней) и кратко для ограничения запросов; в Sentry IP не уходит |
| Не упомянуты местоположение, push, Telegram, WhatsApp, фото мастеров, данные мастеров и бизнесов, гостевая запись | Всё это есть в коде |
| Не названы обработчики и страна хранения | Supabase (ЕС, Швеция), Vercel, Resend, Meta, Telegram, Expo, Sentry, Upstash, Яндекс Карты, сервисы входа |
| Сроки хранения не указаны | В коде есть сроки (раздел 8), часть не задана |
| «О существенных изменениях уведомим по email» | Такого механизма нет |
| `/data-deletion`: «выполним в течение 30 дней», «подтвердим за 3 рабочих дня», «получите уведомление об удалении» | Удаление автоматическое через 7 дней, ежедневной задачей; письма о завершении нет |
| `/data-deletion`: «Удаление необратимо» рядом с «7 дней на отмену» | Верно оба, но порядок путает: сначала 7 дней на отмену, потом необратимо |
| `/data-deletion`: войти «используя email или номер телефона» | Вход через Google, Яндекс, Telegram, WhatsApp, Apple |
| `/data-deletion`: раздел «Опасная зона» | Раздел называется «Удаление аккаунта» |
| `/data-deletion`: «завершённые записи могут храниться только в обезличенном виде» | Все записи клиента остаются у салона с именем «Удалённый пользователь», без телефона и e-mail |
| `/data-deletion`: частичное удаление — отдельные записи, отзывы | Клиент не может удалить запись или отзыв; отзыв можно только изменить; запись — отменить до начала |
| `/data-deletion`: не сказано, когда удаление недоступно | Блокируют: владение бизнесом, карточка мастера, роль в бизнесе, будущие записи |
| `/data-deletion`: «альтернативный способ — по email» | E-mail нет |
| Не сказано, что пропадают пакеты визитов | `client_visit_packages` удаляются каскадно вместе с аккаунтом |
| «Использование Сервиса означает безоговорочное согласие» | Вопрос юристу: согласие по закону КР обычно должно быть явным; на странице входа нет ссылки на политику и условия |

### Замечания по коду для команды (не тексты)

- События `analytics_events` не удаляются задачей хранения и сохраняют `client_id` после удаления аккаунта (нет внешнего ключа). Нужен срок или обезличивание.
- На время 7 дней ожидания удаления выключаются e-mail, Telegram и WhatsApp, но не push.
- Статус `blocked` у запроса на удаление не повторяется сам; пользователь должен запросить снова — стоит показать это в профиле понятным текстом.
- Неиспользованные пакеты визитов удаляются без предупреждения; удаление ими не блокируется.
- Задача хранения запускается раз в сутки из [vercel.json](../../apps/web/vercel.json); факт работы на проде этим черновиком не проверен.

### Источники в коде

[Удаление аккаунта](../../apps/web/src/lib/accountDeletionService.ts), [сроки хранения](../../apps/web/src/lib/dataRetentionCronService.ts), [уведомления](../../apps/web/src/lib/notifications/README.md), [статистика приложения](../../apps/mobile/src/lib/analytics.ts), [приём статистики](../../apps/web/src/lib/analyticsTrackHttpService.ts), [воронка записи](../../apps/web/src/lib/funnelEventsService.ts), [очистка Sentry](../../packages/shared-client/src/sentry.ts), [Sentry на сайте](../../apps/web/src/instrumentation-client.ts), [журнал запросов с IP](../../apps/web/src/lib/apiMetrics.ts), [поиск рядом](../../apps/mobile/src/screens/home/useNearbyBranches.ts), [фото мастеров](../../apps/web/src/lib/staffAvatarUploadService.ts), [гостевая запись](../../apps/web/src/lib/quickBookGuestHttpService.ts), [заявка бизнеса](../../apps/web/src/lib/businessApplicationService.ts), [cookie языка](../../apps/web/src/lib/cookies.ts), [базовая схема](../../supabase/migrations/20261009110000_prod_baseline.sql) (`finalize_due_account_deletions`, `anonymize_old_bookings_pii`, `anonymize_inactive_profiles_pii`), [push-токены](../../supabase/migrations/20261125170000_push_tokens.sql).
