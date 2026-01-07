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


