'use client';

import {createContext, useContext, useEffect, useMemo, useState} from 'react';

type Locale = 'ky' | 'ru' | 'en';

type Translations = Record<string, string>;

type Dictionaries = Record<Locale, Translations>;

const STORAGE_KEY = 'kezek_locale';

const defaultLocale: Locale = 'ky';

const dictionaries: Dictionaries = {
    ky: {
        // Auth / sign-in
        'auth.title': 'Kezek',
        'auth.subtitle': 'Аккаунтты бир нече баскычта түзүңүз же кириңиз — сыр сөз жок',
        'auth.stepsHint': '1) Кирүү ыкмасын тандаңыз · 2) E-mail же аккаунтту ырастаңыз · 3) Профилди автоматтык түзөбүз',
        'auth.variantEmail': '1-ыкма — e‑mail аркылуу кирүү',
        'auth.variantEmailHint':
            'Почтаңызды жазыңыз, биз кирүү үчүн коопсуз шилтеме же код жөнөтөбүз. Сыр сөз ойлоп табуунун кереги жок.',
        'auth.phone.label': 'Телефон номери',
        'auth.phone.help': 'Бул номерге ырастоо коду жөнөтүлөт',
        'auth.email.label': 'E-mail дареги',
        'auth.email.placeholder': 'you@example.com',
        'auth.email.help': 'Бул почтага бир жолку шилтеме же кирүү коду келет.',
        'auth.phone.placeholder': '+996555123456',
        'auth.submit.sending': 'Жөнөтүп жатабыз...',
        'auth.submit.idle': 'Кодду жөнөтүү',
        'auth.otherMethodsTitle': 'же тез кирүү ыкмасын тандаңыз',
        'auth.google': 'Google аркылуу улантуу',
        'auth.yandex': 'Яндекс менен кирүү',
        'auth.whatsapp': 'WhatsApp аркылуу кирүү',
        'auth.firstTime.title':
            'Биринчи жолу келдиңизби? Каалаган кирүү ыкмасын тандаңыз — аккаунт автоматтык түрдө түзүлөт.',
        'auth.firstTime.subtitle':
            'Кийин «Жеке кабинет» бөлүмүндө почтаны, телефонуңузду жана билдирмелерди алуунун ыкмаларын өзгөртө аласыз.',
        'auth.benefits.title': 'Тез жана коопсуз',
        'auth.benefits.subtitle': 'Сыр сөзсүз кириңиз — e‑mail, Google, Telegram же WhatsApp колдонуңуз',
        'auth.benefits.fast.title': 'Дараба кирүү',
        'auth.benefits.fast.desc': 'Катталуусуз жана сыр сөзсүз — ыкманы тандаңыз жана секундада кириңиз',
        'auth.benefits.secure.title': 'Коопсуздук',
        'auth.benefits.secure.desc': 'Бардык маалыматтар корголгон, аккаунт биринчи киргенде автоматтык түрдө түзүлөт',
        'auth.benefits.easy.title': 'Жөнөкөйлүк',
        'auth.benefits.easy.desc': 'Бир баскыч — жана сиз ичиндесиз. Татаал формалар жана узун анкеталар жок',

        // Booking / public flow
        'booking.step.branch': 'Филиал',
        'booking.step.master': 'Кызматкер',
        'booking.step.service': 'Кызмат',
        'booking.step.dayTime': 'Күн жана убакыт',
        'booking.step1.title': 'Кадам 1. Филиалды тандаңыз',
        'booking.step1.noBranches': 'Активдүү филиалдар жок.',
        'booking.step2.title': 'Кадам 2. Кызматкер',
        'booking.step2.noStaff': 'Бул филиалда азырынча активдүү кызматкерлер жок.',
        'booking.step3.title': 'Кадам 3. Кызмат',
        'booking.step3.selectMasterFirst': 'Алгач 2-кадамда кызматкерди тандаңыз.',
        'booking.step3.noServices': 'Тандалган кызматкерде азырынча ыйгарылган кызматтар жок.',
        'booking.step4.title': 'Кадам 4. Күн жана убакыт',
        'booking.step4.masterNoService': 'Тандалган кызматкер бул кызматты аткарбайт',
        'booking.step4.masterNoServiceHint':
            'Сураныч, 3-кадамга кайтып, башка кызматкерди же башка кызматты тандаңыз.',
        'booking.summary.title': 'Сиздин жазылышыңыз',
        'booking.summary.hint':
            'Сол жактагы кадамдар → кызматкерди, кызматты, күндү жана убакытты тандаңыз. Бул жерде ырастамадан мурун жыйынтыкты көрөсүз.',
        'booking.summary.branch': 'Филиал:',
        'booking.summary.service': 'Кызмат:',
        'booking.summary.master': 'Кызматкер:',
        'booking.summary.day': 'Күн:',
        'booking.summary.time': 'Убакыт:',
        'booking.summary.notSelected': 'Тандалган жок',
        'booking.summary.notSelectedFem': 'Тандалган жок',
        'booking.summary.selectSlot': 'Слотту тандаңыз',
        'booking.summary.selectSlotFirst': 'Алгач бош слотту тандаңыз, андан кийин брондоону ырастай аласыз.',
        'booking.summary.estimatedPrice': 'Ориентирлүү баасы:',
        'booking.currency': 'сом',
        'booking.error.masterNotAssigned':
            'Тандалган күнгө кызматкер бул филиалга байланышкан эмес. Башка күндү же кызматкерди тандаңыз.',
        'booking.needAuth':
            'Брондоо үчүн кирүү же катталуу керек. Барактын жогору жагындагы «Кирүү» баскычын басыңыз.',
        'booking.phoneLabel': 'Телефон:',
        'booking.freeSlots': 'Бош слоттор',
        'booking.loadingSlots': 'Бош слотторду жүктөп жатабыз...',
        'booking.noSlots': 'Бул күнгө бош терезедер жок. Башка күндү же кызматкерди тандаңыз.',
        'booking.today': 'Бүгүн',
        'booking.tomorrow': 'Эртең',
        'booking.duration.label': 'Узактыгы:',
        'booking.duration.min': 'мин',
        'booking.existingBookings.warning.one':
            'Сизде бул кызматта тандалган күндө бир активдүү жазылыш бар.',
        'booking.existingBookings.warning.many':
            'Сизде бул кызматта тандалган күндө активдүү жазылыштар бар.',
        'booking.existingBookings.hint':
            'Керек болсо, дагы бир жазылышты каттасаңыз болот.',
        'booking.nav.back': '← Артка',
        'booking.nav.next': 'Улантуу →',

        // Home page
        'home.title': 'Кызматты табыңыз',
        'home.subtitle': 'Кызматтарга бир нече клик менен жазылыңыз — чалуусуз жана жазышуусуз',
        'home.search.placeholder': 'Аталышы же дареги боюнча издөө...',
        'home.search.submit': 'Издөө',
        'home.search.reset': 'Тазалоо',
        'home.cats.title': 'Популярдуу категориялар:',
        'home.cats.all': 'Баары',
        'home.card.book': 'Жазылуу',
        'home.empty': 'Эч нерсе табылган жок',

        // Header
        'header.signIn': 'Кирүү',
        'header.signInShort': 'Кир',
        'header.signOut': 'Чыгуу',
        'header.loading': 'Жүктөп жатабыз...',
        'header.account': 'аккаунт',
        'header.language': 'Тил',
        'header.adminPanel': 'Админ-панель',
        'header.ownerCabinet': 'Ээсинин кабинети',
        'header.staffCabinet': 'Кызматкердин кабинети',
        'header.staffCabinetShort': 'Кызматкер',
        'header.businessCabinet': 'Бизнес кабинети',
        'header.myBookings': 'Менин жазылыштарым',
        'header.personalCabinet': 'Жеке кабинет',
        'header.cabinetShort': 'Кабинет',

        // Dashboard
        'dashboard.header.badge': 'Бизнес ээсинин кабинети',
        'dashboard.header.defaultBizName': 'Сиздин бизнесиңиз Kezekте',
        'dashboard.stats.bookingsToday': 'Бүгүнкү брондоолор',
        'dashboard.stats.bookingsTodayHint': 'календарда жазылыштар',
        'dashboard.stats.activeStaff': 'Активдүү кызматкерлер',
        'dashboard.stats.activeStaffHint': 'кардарларды кабыл алууга даяр',
        'dashboard.onboarding.title': 'Кабинетти иштөө абалына келтирүүнү баштайлы.',
        'dashboard.onboarding.noBranches': 'Кардарлар жазыла алыш үчүн эң аз дегенде бир филиалды түзүңүз.',
        'dashboard.onboarding.noServices': 'Кызматтарды кошуп, узактыгы менен баасын көрсөтүңүз.',
        'dashboard.onboarding.noStaff': 'Кызматкерлерди кошуп, ким кайсы кызматтарды аткарарын көрсөтүңүз.',
        'dashboard.onboarding.noBookings': '«Календарьды» текшериңиз — биринчи брондоолор бул жерде автоматтык түрдө пайда болот.',
        'dashboard.kpi.bookingsToday': 'Бүгүнкү брондоолор',
        'dashboard.kpi.openCalendar': 'Календарьды ачуу',
        'dashboard.kpi.activeStaff': 'Активдүү кызматкерлер',
        'dashboard.kpi.manageStaff': 'Кызматкерлерди башкаруу',
        'dashboard.kpi.activeServices': 'Активдүү кызматтар',
        'dashboard.kpi.goToServices': 'Кызматтарга өтүү',
        'dashboard.kpi.branches': 'Филиалдар',
        'dashboard.kpi.branchesList': 'Филиалдардын тизмеси',
        'dashboard.quickActions.title': 'Тез аракеттер',
        'dashboard.quickActions.subtitle': 'Ээге убакытты үнөмдөгөн көп колдонулган операциялар.',
        'dashboard.quickActions.openCalendar': '«Календарьды» ачуу',
        'dashboard.quickActions.openCalendarHint': 'жакынкы жазылыштарды көрүү',
        'dashboard.quickActions.addStaff': 'Кызматкерди кошуу',
        'dashboard.quickActions.addStaffHint': 'кызматкерди системага кошуу',
        'dashboard.quickActions.addService': 'Кызматты кошуу',
        'dashboard.quickActions.addServiceHint': 'баасы менен узактыгын көрсөтүү',
        'dashboard.quickActions.assignServices': 'Кызматкерге кызматтарды ыйгаруу',
        'dashboard.quickActions.assignServicesHint': 'кызматтарды кызматкерлерге бөлүштүрүү',
        'dashboard.quickActions.navigationHint': 'Сол жактагы навигация кабинеттин бардык барактарында жеткиликтүү — сиз ар дайым керектүү бөлүмгө тез кайта аласыз.',
        'dashboard.error.noAccess': 'Кабинетке кирүү мүмкүн эмес',
        'dashboard.error.noAccessDesc': 'Сиздин эсебиңизде эч бир бизнесте <code>owner / admin / manager</code> ролдору жок.',
        'dashboard.error.general': 'Ката',
        'dashboard.error.generalDesc': 'Кабинетти жүктөөдө ката кетти. Сураныч, баракты жаңылаңыз.',
        'dashboard.error.details': 'Деталдар:',
        'dashboard.error.goToPublic': 'Жалпы көрүнүшкө өтүү',
        'dashboard.sidebar.title': 'Бизнес кабинети',
        'dashboard.sidebar.openMenu': 'Менюну ачуу',
        'dashboard.sidebar.closeMenu': 'Менюну жабуу',
        'notifications.whatsapp.message': 'WhatsApp аркылуу брондоолор жөнүндө эскертүүлөрдү алуу үчүн туташтырыңыз. Бул ыңгайлуу жана тезирээк!',
        'notifications.whatsapp.connectFull': 'WhatsAppти туташтыруу',
        'notifications.whatsapp.connectShort': 'Туташтыруу',
        'notifications.telegram.message': 'Telegram аркылуу брондоолор жөнүндө эскертүүлөрдү алуу үчүн туташтырыңыз. Бул ыңгайлуу жана коопсуз!',
        'notifications.telegram.connectFull': 'Telegramды туташтыруу',
        'notifications.telegram.connectShort': 'Туташтыруу',
        'notifications.close': 'Жабуу',
        'dashboard.nav.home': 'Башкы',
        'dashboard.nav.bookings': 'Брондоолор',
        'dashboard.nav.staff': 'Кызматкерлер',
        'dashboard.nav.services': 'Кызматтар',
        'dashboard.nav.branches': 'Филиалдар',
        // Bookings
        'bookings.title': 'Брондоолор',
        'bookings.subtitle': 'Брондоолорду башкаруу',
        'bookings.tabs.calendar': 'Календарь',
        'bookings.tabs.list': 'Тизме',
        'bookings.tabs.desk': 'Стойка',
        'bookings.calendar.title': 'Күндүн календары',
        'bookings.calendar.time': 'Убакыт',
        'bookings.calendar.exportCsv': 'CSV экспорттоо',
        'bookings.calendar.openBooking': 'Брондоону ачуу',
        'bookings.status.hold': 'hold',
        'bookings.status.confirmed': 'confirmed',
        'bookings.status.paid': 'paid / келди',
        'bookings.status.noShow': 'no_show / келген жок',
        'bookings.status.noShowShort': 'келген жок',
        'bookings.status.attended': 'келди',
        'bookings.status.cancelled': 'cancelled',
        'bookings.list.title': 'Акыркы 30 брондоо',
        'bookings.list.refresh': 'Жаңылоо',
        'bookings.list.service': 'Кызмат',
        'bookings.list.master': 'Устат',
        'bookings.list.start': 'Башталышы',
        'bookings.list.status': 'Статус',
        'bookings.list.actions': 'Аракеттер',
        'bookings.list.markAttendanceError': 'Статусту жаңылоо мүмкүн болгон жок',
        'bookings.actions.attended': 'Келди',
        'bookings.actions.noShow': 'Келген жок',
        'bookings.actions.cancel': 'Жокко чыгаруу',
        'bookings.actions.confirm': 'Ырастоо',
        'bookings.desk.title': 'Тез жазылыш (стойка)',
        'bookings.desk.client': 'Кардар',
        'bookings.desk.clientNone': 'Кардарсыз (walk-in)',
        'bookings.desk.clientExisting': 'Бар болгон',
        'bookings.desk.clientNew': 'Жаңы (тез)',
        'bookings.desk.searchPlaceholder': 'Издөө: +996..., email, Аты-жөнү',
        'bookings.desk.searching': 'Издейбиз…',
        'bookings.desk.search': 'Табуу',
        'bookings.desk.clientName': 'Аты',
        'bookings.desk.clientPhone': 'Телефон',
        'bookings.desk.select': 'Тандоо',
        'bookings.desk.noResults': 'Эч нерсе табылган жок',
        'bookings.desk.newClientNamePlaceholder': 'Аты (милдеттүү эмес)',
        'bookings.desk.newClientPhonePlaceholder': 'Телефон (каалаган)',
        'bookings.desk.newClientHint': 'Бул маалыматтар брондоодо гана сакталат (аккаунт түзүлбөйт).',
        'bookings.desk.create': 'Жазылыш түзүү',
        'bookings.desk.slotsHint': 'Слоттор `get_free_slots_service_day` боюнча эсептелет, график жана бош эмес брондоолорду эске алуу менен.',
        'bookings.desk.noServices': 'Филиалда кызматтар жок',
        'bookings.desk.noMasters': 'Филиалда устаттар жок',
        'bookings.desk.noSlots': 'Бош слоттор жок',
        'bookings.desk.errors.selectService': 'Кызматты тандаңыз',
        'bookings.desk.errors.noSlots': 'Тандалган параметрлер үчүн бош слоттор жок',
        'bookings.desk.errors.selectMaster': 'Устатты тандаңыз',
        'bookings.desk.errors.selectClient': 'Издөөдөн кардарды тандаңыз',
        'bookings.desk.errors.clientNameOrPhone': 'Жаңы кардардын атын же телефонун көрсөтүңүз',
        'bookings.desk.created': 'Жазылыш түзүлдү',
        // Footer
        'footer.rights': 'Бардык укуктар корголгон.',
        'footer.privacy': 'Купуялык саясаты',
        'footer.terms': 'Пайдалануучу келишими',
        'footer.dataDeletion': 'Маалыматтарды өчүрүү',
    },
    ru: {
        // Auth / sign-in
        'auth.title': 'Kezek',
        'auth.subtitle': 'Войдите или создайте аккаунт за пару кликов — без пароля и сложных форм',
        'auth.stepsHint':
            '1) Выберите способ входа · 2) Подтвердите e‑mail или аккаунт · 3) Мы автоматически создадим профиль',
        'auth.variantEmail': 'Вариант 1 — вход по e‑mail',
        'auth.variantEmailHint':
            'Укажите почту, мы пришлём на неё безопасную ссылку/код для входа. Пароль придумывать не нужно.',
        'auth.phone.label': 'Номер телефона',
        'auth.phone.help': 'Мы отправим код подтверждения на этот номер',
        'auth.email.label': 'E-mail адрес',
        'auth.email.placeholder': 'you@example.com',
        'auth.email.help': 'На эту почту придёт одноразовая ссылка или код для входа.',
        'auth.phone.placeholder': '+996555123456',
        'auth.submit.sending': 'Отправляю...',
        'auth.submit.idle': 'Отправить код',
        'auth.otherMethodsTitle': 'или выберите быстрый вход',
        'auth.google': 'Продолжить с Google',
        'auth.yandex': 'Войти через Яндекс',
        'auth.whatsapp': 'Войти через WhatsApp',
        'auth.firstTime.title':
            'Впервые здесь? Просто выберите любой способ входа — аккаунт создастся автоматически, без лишних полей.',
        'auth.firstTime.subtitle':
            'Вы всегда можете сменить почту, номер телефона и способы уведомлений в разделе «Личный кабинет».',
        'auth.benefits.title': 'Быстро и безопасно',
        'auth.benefits.subtitle': 'Войдите без пароля — используйте e‑mail, Google, Telegram или WhatsApp',
        'auth.benefits.fast.title': 'Мгновенный вход',
        'auth.benefits.fast.desc': 'Без регистрации и паролей — выберите способ и войдите за секунды',
        'auth.benefits.secure.title': 'Безопасность',
        'auth.benefits.secure.desc': 'Все данные защищены, аккаунт создаётся автоматически при первом входе',
        'auth.benefits.easy.title': 'Простота',
        'auth.benefits.easy.desc': 'Один клик — и вы уже внутри. Никаких сложных форм и длинных анкет',

        // Booking / public flow
        'booking.step.branch': 'Филиал',
        'booking.step.master': 'Сотрудник',
        'booking.step.service': 'Услуга',
        'booking.step.dayTime': 'День и время',
        'booking.step1.title': 'Шаг 1. Выберите филиал',
        'booking.step1.noBranches': 'Нет активных филиалов.',
        'booking.step2.title': 'Шаг 2. Мастер',
        'booking.step2.noStaff': 'В этом филиале пока нет активных сотрудников.',
        'booking.step3.title': 'Шаг 3. Услуга',
        'booking.step3.selectMasterFirst': 'Сначала выберите мастера на шаге 2.',
        'booking.step3.noServices': 'У выбранного мастера пока нет назначенных услуг.',
        'booking.step4.title': 'Шаг 4. День и время',
        'booking.step4.masterNoService': 'Выбранный мастер не выполняет эту услугу',
        'booking.step4.masterNoServiceHint':
            'Пожалуйста, вернитесь к шагу 3 и выберите другого мастера или выберите другую услугу.',
        'booking.summary.title': 'Ваша запись',
        'booking.summary.hint':
            'Шаги слева → выберите мастера, услугу, день и время. Здесь вы увидите итог перед подтверждением.',
        'booking.summary.branch': 'Филиал:',
        'booking.summary.service': 'Услуга:',
        'booking.summary.master': 'Мастер:',
        'booking.summary.day': 'День:',
        'booking.summary.time': 'Время:',
        'booking.summary.notSelected': 'Не выбран',
        'booking.summary.notSelectedFem': 'Не выбрана',
        'booking.summary.selectSlot': 'Выберите слот',
        'booking.summary.selectSlotFirst': 'Сначала выберите свободный слот, затем вы сможете подтвердить бронь.',
        'booking.summary.estimatedPrice': 'Ориентировочная стоимость:',
        'booking.currency': 'сом',
        'booking.error.masterNotAssigned':
            'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.',
        'booking.needAuth':
            'Для бронирования необходимо войти или зарегистрироваться. Нажмите кнопку «Войти» вверху страницы.',
        'booking.phoneLabel': 'Телефон:',
        'booking.freeSlots': 'Свободные слоты',
        'booking.loadingSlots': 'Загружаем свободные слоты...',
        'booking.noSlots': 'Нет свободных окон на этот день. Попробуйте выбрать другой день или мастера.',
        'booking.today': 'Сегодня',
        'booking.tomorrow': 'Завтра',
        'booking.duration.label': 'Продолжительность:',
        'booking.duration.min': 'мин',
        'booking.existingBookings.warning.one':
            'У вас уже есть одна активная запись в этом заведении на выбранный день.',
        'booking.existingBookings.warning.many':
            'У вас уже есть активных записей в этом заведении на выбранный день.',
        'booking.existingBookings.hint':
            'Вы всё равно можете оформить ещё одну запись, если это необходимо.',
        'booking.nav.back': '← Назад',
        'booking.nav.next': 'Далее →',

        // Home page
        'home.title': 'Найдите свой сервис',
        'home.subtitle': 'Запись в любые сервисы за пару кликов — без звонков и переписок',
        'home.search.placeholder': 'Поиск по названию или адресу...',
        'home.search.submit': 'Искать',
        'home.search.reset': 'Сброс',
        'home.cats.title': 'Популярные категории:',
        'home.cats.all': 'Все',
        'home.card.book': 'Записаться',
        'home.empty': 'Ничего не найдено',

        // Header
        'header.signIn': 'Войти',
        'header.signInShort': 'Вход',
        'header.signOut': 'Выйти',
        'header.loading': 'Загрузка...',
        'header.account': 'аккаунт',
        'header.language': 'Язык',
        'header.adminPanel': 'Админ-панель',
        'header.ownerCabinet': 'Кабинет владельца',
        'header.staffCabinet': 'Кабинет сотрудника',
        'header.staffCabinetShort': 'Сотрудник',
        'header.businessCabinet': 'Кабинет бизнеса',
        'header.myBookings': 'Мои записи',
        'header.personalCabinet': 'Личный кабинет',
        'header.cabinetShort': 'Кабинет',

        // Dashboard
        'dashboard.header.badge': 'Кабинет владельца бизнеса',
        'dashboard.header.defaultBizName': 'Ваш бизнес в Kezek',
        'dashboard.stats.bookingsToday': 'Брони сегодня',
        'dashboard.stats.bookingsTodayHint': 'в календаре записи',
        'dashboard.stats.activeStaff': 'Активных сотрудников',
        'dashboard.stats.activeStaffHint': 'готовы принимать клиентов',
        'dashboard.onboarding.title': 'Давайте доведём кабинет до рабочего состояния.',
        'dashboard.onboarding.noBranches': 'Создайте хотя бы один филиал, чтобы клиенты могли записываться.',
        'dashboard.onboarding.noServices': 'Добавьте услуги и укажите продолжительность и цену.',
        'dashboard.onboarding.noStaff': 'Добавьте сотрудников и укажите, кто оказывает какие услуги.',
        'dashboard.onboarding.noBookings': 'Проверьте «Календарь» — первые бронирования появятся здесь автоматически.',
        'dashboard.kpi.bookingsToday': 'Брони сегодня',
        'dashboard.kpi.openCalendar': 'Открыть календарь',
        'dashboard.kpi.activeStaff': 'Активные сотрудники',
        'dashboard.kpi.manageStaff': 'Управлять сотрудниками',
        'dashboard.kpi.activeServices': 'Активные услуги',
        'dashboard.kpi.goToServices': 'Перейти к услугам',
        'dashboard.kpi.branches': 'Филиалы',
        'dashboard.kpi.branchesList': 'Список филиалов',
        'dashboard.quickActions.title': 'Быстрые действия',
        'dashboard.quickActions.subtitle': 'Частые операции, которые экономят время владельцу.',
        'dashboard.quickActions.openCalendar': 'Открыть «Календарь»',
        'dashboard.quickActions.openCalendarHint': 'посмотреть ближайшие записи',
        'dashboard.quickActions.addStaff': 'Добавить сотрудника',
        'dashboard.quickActions.addStaffHint': 'добавить сотрудника в систему',
        'dashboard.quickActions.addService': 'Добавить услугу',
        'dashboard.quickActions.addServiceHint': 'указать цену и длительность',
        'dashboard.quickActions.assignServices': 'Назначить услуги сотруднику',
        'dashboard.quickActions.assignServicesHint': 'распределить услуги по сотрудникам',
        'dashboard.quickActions.navigationHint': 'Навигация слева доступна на всех страницах кабинета — вы всегда можете быстро вернуться к нужному разделу.',
        'dashboard.error.noAccess': 'Нет доступа к кабинету',
        'dashboard.error.noAccessDesc': 'У вашей учётной записи нет ролей <code>owner / admin / manager</code> ни в одном бизнесе.',
        'dashboard.error.general': 'Ошибка',
        'dashboard.error.generalDesc': 'Произошла ошибка при загрузке кабинета. Пожалуйста, попробуйте обновить страницу.',
        'dashboard.error.details': 'Детали:',
        'dashboard.error.goToPublic': 'Перейти на публичную витрину',
        'dashboard.sidebar.title': 'Кабинет бизнеса',
        'dashboard.sidebar.openMenu': 'Открыть меню',
        'dashboard.sidebar.closeMenu': 'Закрыть меню',
        'notifications.whatsapp.message': 'Подключите WhatsApp для получения уведомлений о бронированиях. Это удобнее и быстрее!',
        'notifications.whatsapp.connectFull': 'Подключить WhatsApp',
        'notifications.whatsapp.connectShort': 'Подключить',
        'notifications.telegram.message': 'Подключите Telegram для получения уведомлений о бронированиях. Это удобно и безопасно!',
        'notifications.telegram.connectFull': 'Подключить Telegram',
        'notifications.telegram.connectShort': 'Подключить',
        'notifications.close': 'Закрыть',
        'dashboard.nav.home': 'Главная',
        'dashboard.nav.bookings': 'Брони',
        'dashboard.nav.staff': 'Сотрудники',
        'dashboard.nav.services': 'Услуги',
        'dashboard.nav.branches': 'Филиалы',
        // Bookings
        'bookings.title': 'Брони',
        'bookings.subtitle': 'Управление бронированиями',
        'bookings.tabs.calendar': 'Календарь',
        'bookings.tabs.list': 'Список',
        'bookings.tabs.desk': 'Стойка',
        'bookings.calendar.title': 'Календарь на день',
        'bookings.calendar.time': 'Время',
        'bookings.calendar.exportCsv': 'Экспорт CSV',
        'bookings.calendar.openBooking': 'Открыть бронь',
        'bookings.status.hold': 'hold',
        'bookings.status.confirmed': 'confirmed',
        'bookings.status.paid': 'paid / пришел',
        'bookings.status.noShow': 'no_show / не пришел',
        'bookings.status.noShowShort': 'не пришел',
        'bookings.status.attended': 'пришел',
        'bookings.status.cancelled': 'cancelled',
        'bookings.list.title': 'Последние 30 броней',
        'bookings.list.refresh': 'Обновить',
        'bookings.list.service': 'Услуга',
        'bookings.list.master': 'Мастер',
        'bookings.list.start': 'Начало',
        'bookings.list.status': 'Статус',
        'bookings.list.actions': 'Действия',
        'bookings.list.markAttendanceError': 'Не удалось обновить статус',
        'bookings.actions.attended': 'Пришел',
        'bookings.actions.noShow': 'Не пришел',
        'bookings.actions.cancel': 'Отменить',
        'bookings.actions.confirm': 'Подтвердить',
        'bookings.desk.title': 'Быстрая запись (стойка)',
        'bookings.desk.client': 'Клиент',
        'bookings.desk.clientNone': 'Без клиента (walk-in)',
        'bookings.desk.clientExisting': 'Существующий',
        'bookings.desk.clientNew': 'Новый (быстрый)',
        'bookings.desk.searchPlaceholder': 'Поиск: +996..., email, ФИО',
        'bookings.desk.searching': 'Ищем…',
        'bookings.desk.search': 'Найти',
        'bookings.desk.clientName': 'Имя',
        'bookings.desk.clientPhone': 'Телефон',
        'bookings.desk.select': 'Выбрать',
        'bookings.desk.noResults': 'Ничего не найдено',
        'bookings.desk.newClientNamePlaceholder': 'Имя (необязательно)',
        'bookings.desk.newClientPhonePlaceholder': 'Телефон (желательно)',
        'bookings.desk.newClientHint': 'Эти данные сохранятся только в брони (без создания аккаунта).',
        'bookings.desk.create': 'Создать запись',
        'bookings.desk.slotsHint': 'Слоты считаются по `get_free_slots_service_day` с учётом расписания и занятых броней.',
        'bookings.desk.noServices': 'Нет услуг в филиале',
        'bookings.desk.noMasters': 'Нет мастеров в филиале',
        'bookings.desk.noSlots': 'Нет свободных слотов',
        'bookings.desk.errors.selectService': 'Выбери услугу',
        'bookings.desk.errors.noSlots': 'Нет свободных слотов на выбранные параметры',
        'bookings.desk.errors.selectMaster': 'Выбери мастера',
        'bookings.desk.errors.selectClient': 'Выбери клиента из поиска',
        'bookings.desk.errors.clientNameOrPhone': 'Укажи имя или телефон нового клиента',
        'bookings.desk.created': 'Создана запись',
        // Footer
        'footer.rights': 'Все права защищены.',
        'footer.privacy': 'Политика конфиденциальности',
        'footer.terms': 'Пользовательское соглашение',
        'footer.dataDeletion': 'Удаление данных',
    },
    en: {
        // Auth / sign-in
        'auth.title': 'Kezek',
        'auth.subtitle': 'Sign in or create an account in a few clicks — no password, no long forms',
        'auth.stepsHint':
            '1) Choose a sign‑in method · 2) Confirm your e‑mail or account · 3) We create your profile automatically',
        'auth.variantEmail': 'Option 1 — sign in with e‑mail',
        'auth.variantEmailHint':
            'Enter your e‑mail, we will send a secure magic link or one‑time code. No password required.',
        'auth.phone.label': 'Phone number',
        'auth.phone.help': 'We will send a confirmation code to this number',
        'auth.email.label': 'E‑mail address',
        'auth.email.placeholder': 'you@example.com',
        'auth.email.help': 'A one‑time link or code for sign‑in will be sent to this e‑mail.',
        'auth.phone.placeholder': '+996555123456',
        'auth.submit.sending': 'Sending...',
        'auth.submit.idle': 'Send code',
        'auth.otherMethodsTitle': 'or choose a quick sign‑in option',
        'auth.google': 'Continue with Google',
        'auth.yandex': 'Sign in with Yandex',
        'auth.whatsapp': 'Sign in with WhatsApp',
        'auth.firstTime.title':
            'New here? Just choose any sign‑in method — we will create an account for you automatically.',
        'auth.firstTime.subtitle':
            'Later you can change your e‑mail, phone number and notification channels in "My profile".',
        'auth.benefits.title': 'Fast and secure',
        'auth.benefits.subtitle': 'Sign in without a password — use e‑mail, Google, Telegram or WhatsApp',
        'auth.benefits.fast.title': 'Instant access',
        'auth.benefits.fast.desc': 'No registration or passwords — choose a method and sign in within seconds',
        'auth.benefits.secure.title': 'Security',
        'auth.benefits.secure.desc': 'All data is protected, account is created automatically on first sign‑in',
        'auth.benefits.easy.title': 'Simplicity',
        'auth.benefits.easy.desc': 'One click — and you are in. No complex forms or long questionnaires',

        // Booking / public flow
        'booking.step.branch': 'Branch',
        'booking.step.master': 'Staff',
        'booking.step.service': 'Service',
        'booking.step.dayTime': 'Day & time',
        'booking.step1.title': 'Step 1. Select a branch',
        'booking.step1.noBranches': 'No active branches.',
        'booking.step2.title': 'Step 2. Master',
        'booking.step2.noStaff': 'This branch has no active staff yet.',
        'booking.step3.title': 'Step 3. Service',
        'booking.step3.selectMasterFirst': 'First select a master in step 2.',
        'booking.step3.noServices': 'The selected master has no assigned services yet.',
        'booking.step4.title': 'Step 4. Day and time',
        'booking.step4.masterNoService': 'The selected master does not perform this service',
        'booking.step4.masterNoServiceHint':
            'Please go back to step 3 and select another master or select another service.',
        'booking.summary.title': 'Your booking',
        'booking.summary.hint':
            'Steps on the left → select a master, service, day, and time. Here you will see the result before confirmation.',
        'booking.summary.branch': 'Branch:',
        'booking.summary.service': 'Service:',
        'booking.summary.master': 'Master:',
        'booking.summary.day': 'Day:',
        'booking.summary.time': 'Time:',
        'booking.summary.notSelected': 'Not selected',
        'booking.summary.notSelectedFem': 'Not selected',
        'booking.summary.selectSlot': 'Select slot',
        'booking.summary.selectSlotFirst': 'First select an available slot, then you can confirm the booking.',
        'booking.summary.estimatedPrice': 'Estimated price:',
        'booking.currency': 'KGS',
        'booking.error.masterNotAssigned':
            'On the selected date, the master is not assigned to this branch. Try selecting another day or master.',
        'booking.needAuth':
            'To make a booking you need to sign in or sign up. Click the "Sign in" button at the top of the page.',
        'booking.phoneLabel': 'Phone:',
        'booking.freeSlots': 'Available slots',
        'booking.loadingSlots': 'Loading available slots...',
        'booking.noSlots': 'No available slots for this day. Try selecting another day or master.',
        'booking.today': 'Today',
        'booking.tomorrow': 'Tomorrow',
        'booking.duration.label': 'Duration:',
        'booking.duration.min': 'min',
        'booking.existingBookings.warning.one':
            'You already have one active booking in this business on the selected day.',
        'booking.existingBookings.warning.many':
            'You already have active bookings in this business on the selected day.',
        'booking.existingBookings.hint':
            'You can still make another booking if needed.',
        'booking.nav.back': '← Back',
        'booking.nav.next': 'Next →',

        // Home page
        'home.title': 'Find your service',
        'home.subtitle': 'Book any service in a few clicks — no calls or chats',
        'home.search.placeholder': 'Search by name or address...',
        'home.search.submit': 'Search',
        'home.search.reset': 'Reset',
        'home.cats.title': 'Popular categories:',
        'home.cats.all': 'All',
        'home.card.book': 'Book now',
        'home.empty': 'Nothing found',

        // Header
        'header.signIn': 'Sign in',
        'header.signInShort': 'Login',
        'header.signOut': 'Sign out',
        'header.loading': 'Loading...',
        'header.account': 'account',
        'header.language': 'Language',
        'header.adminPanel': 'Admin panel',
        'header.ownerCabinet': 'Owner cabinet',
        'header.staffCabinet': 'Staff cabinet',
        'header.staffCabinetShort': 'Staff',
        'header.businessCabinet': 'Business cabinet',
        'header.myBookings': 'My bookings',
        'header.personalCabinet': 'Personal cabinet',
        'header.cabinetShort': 'Cabinet',

        // Dashboard
        'dashboard.header.badge': 'Business owner cabinet',
        'dashboard.header.defaultBizName': 'Your business in Kezek',
        'dashboard.stats.bookingsToday': 'Bookings today',
        'dashboard.stats.bookingsTodayHint': 'in booking calendar',
        'dashboard.stats.activeStaff': 'Active staff',
        'dashboard.stats.activeStaffHint': 'ready to serve clients',
        'dashboard.onboarding.title': "Let's get the cabinet ready for work.",
        'dashboard.onboarding.noBranches': 'Create at least one branch so clients can book.',
        'dashboard.onboarding.noServices': 'Add services and specify duration and price.',
        'dashboard.onboarding.noStaff': 'Add staff and specify who provides which services.',
        'dashboard.onboarding.noBookings': 'Check the "Calendar" — first bookings will appear here automatically.',
        'dashboard.kpi.bookingsToday': 'Bookings today',
        'dashboard.kpi.openCalendar': 'Open calendar',
        'dashboard.kpi.activeStaff': 'Active staff',
        'dashboard.kpi.manageStaff': 'Manage staff',
        'dashboard.kpi.activeServices': 'Active services',
        'dashboard.kpi.goToServices': 'Go to services',
        'dashboard.kpi.branches': 'Branches',
        'dashboard.kpi.branchesList': 'Branches list',
        'dashboard.quickActions.title': 'Quick actions',
        'dashboard.quickActions.subtitle': 'Frequent operations that save time for the owner.',
        'dashboard.quickActions.openCalendar': 'Open "Calendar"',
        'dashboard.quickActions.openCalendarHint': 'view upcoming bookings',
        'dashboard.quickActions.addStaff': 'Add staff',
        'dashboard.quickActions.addStaffHint': 'add staff to the system',
        'dashboard.quickActions.addService': 'Add service',
        'dashboard.quickActions.addServiceHint': 'specify price and duration',
        'dashboard.quickActions.assignServices': 'Assign services to staff',
        'dashboard.quickActions.assignServicesHint': 'distribute services among staff',
        'dashboard.quickActions.navigationHint': 'Left navigation is available on all cabinet pages — you can always quickly return to the needed section.',
        'dashboard.error.noAccess': 'No access to cabinet',
        'dashboard.error.noAccessDesc': 'Your account does not have <code>owner / admin / manager</code> roles in any business.',
        'dashboard.error.general': 'Error',
        'dashboard.error.generalDesc': 'An error occurred while loading the cabinet. Please try refreshing the page.',
        'dashboard.error.details': 'Details:',
        'dashboard.error.goToPublic': 'Go to public showcase',
        'dashboard.sidebar.title': 'Business cabinet',
        'dashboard.sidebar.openMenu': 'Open menu',
        'dashboard.sidebar.closeMenu': 'Close menu',
        'notifications.whatsapp.message': "Connect WhatsApp to receive booking notifications. It's more convenient and faster!",
        'notifications.whatsapp.connectFull': 'Connect WhatsApp',
        'notifications.whatsapp.connectShort': 'Connect',
        'notifications.telegram.message': "Connect Telegram to receive booking notifications. It's convenient and secure!",
        'notifications.telegram.connectFull': 'Connect Telegram',
        'notifications.telegram.connectShort': 'Connect',
        'notifications.close': 'Close',
        'dashboard.nav.home': 'Home',
        'dashboard.nav.bookings': 'Bookings',
        'dashboard.nav.staff': 'Staff',
        'dashboard.nav.services': 'Services',
        'dashboard.nav.branches': 'Branches',
        // Bookings
        'bookings.title': 'Bookings',
        'bookings.subtitle': 'Booking management',
        'bookings.tabs.calendar': 'Calendar',
        'bookings.tabs.list': 'List',
        'bookings.tabs.desk': 'Desk',
        'bookings.calendar.title': 'Day calendar',
        'bookings.calendar.time': 'Time',
        'bookings.calendar.exportCsv': 'Export CSV',
        'bookings.calendar.openBooking': 'Open booking',
        'bookings.status.hold': 'hold',
        'bookings.status.confirmed': 'confirmed',
        'bookings.status.paid': 'paid / attended',
        'bookings.status.noShow': 'no_show / did not attend',
        'bookings.status.noShowShort': 'did not attend',
        'bookings.status.attended': 'attended',
        'bookings.status.cancelled': 'cancelled',
        'bookings.list.title': 'Last 30 bookings',
        'bookings.list.refresh': 'Refresh',
        'bookings.list.service': 'Service',
        'bookings.list.master': 'Master',
        'bookings.list.start': 'Start',
        'bookings.list.status': 'Status',
        'bookings.list.actions': 'Actions',
        'bookings.list.markAttendanceError': 'Failed to update status',
        'bookings.actions.attended': 'Attended',
        'bookings.actions.noShow': 'Did not attend',
        'bookings.actions.cancel': 'Cancel',
        'bookings.actions.confirm': 'Confirm',
        'bookings.desk.title': 'Quick booking (desk)',
        'bookings.desk.client': 'Client',
        'bookings.desk.clientNone': 'No client (walk-in)',
        'bookings.desk.clientExisting': 'Existing',
        'bookings.desk.clientNew': 'New (quick)',
        'bookings.desk.searchPlaceholder': 'Search: +996..., email, Full name',
        'bookings.desk.searching': 'Searching…',
        'bookings.desk.search': 'Find',
        'bookings.desk.clientName': 'Name',
        'bookings.desk.clientPhone': 'Phone',
        'bookings.desk.select': 'Select',
        'bookings.desk.noResults': 'Nothing found',
        'bookings.desk.newClientNamePlaceholder': 'Name (optional)',
        'bookings.desk.newClientPhonePlaceholder': 'Phone (preferred)',
        'bookings.desk.newClientHint': 'This data will be saved only in the booking (without creating an account).',
        'bookings.desk.create': 'Create booking',
        'bookings.desk.slotsHint': 'Slots are calculated by `get_free_slots_service_day` taking into account schedule and occupied bookings.',
        'bookings.desk.noServices': 'No services in branch',
        'bookings.desk.noMasters': 'No masters in branch',
        'bookings.desk.noSlots': 'No free slots',
        'bookings.desk.errors.selectService': 'Select service',
        'bookings.desk.errors.noSlots': 'No free slots for selected parameters',
        'bookings.desk.errors.selectMaster': 'Select master',
        'bookings.desk.errors.selectClient': 'Select client from search',
        'bookings.desk.errors.clientNameOrPhone': 'Specify name or phone of new client',
        'bookings.desk.created': 'Booking created',
        // Footer
        'footer.rights': 'All rights reserved.',
        'footer.privacy': 'Privacy policy',
        'footer.terms': 'Terms of service',
        'footer.dataDeletion': 'Data deletion',
    },
};

interface LanguageContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({children}: {children: React.ReactNode}) {
    const [locale, setLocaleState] = useState<Locale>(defaultLocale);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
            if (saved && ['ky', 'ru', 'en'].includes(saved)) {
                setLocaleState(saved);
                return;
            }
            const browser = window.navigator.language.slice(0, 2);
            if (browser === 'ru' || browser === 'en' || browser === 'ky') {
                setLocaleState(browser as Locale);
            }
        } catch {
            // ignore
        }
    }, []);

    const setLocale = (next: Locale) => {
        setLocaleState(next);
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(STORAGE_KEY, next);
            } catch {
                // ignore
            }
        }
    };

    const t = (key: string, fallback?: string) => {
        const dict = dictionaries[locale] || {};
        if (Object.prototype.hasOwnProperty.call(dict, key)) {
            return dict[key];
        }
        const ruDict = dictionaries.ru || {};
        if (Object.prototype.hasOwnProperty.call(ruDict, key)) {
            return ruDict[key];
        }
        return fallback ?? key;
    };

    const value = useMemo(
        () => ({
            locale,
            setLocale,
            t,
        }),
        [locale]
    );

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return ctx;
}


