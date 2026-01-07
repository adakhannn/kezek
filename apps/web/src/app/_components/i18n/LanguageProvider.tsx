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
        'booking.needAuth':
            'Брондоо үчүн кирүү же катталуу керек. Барактын жогору жагындагы «Кирүү» баскычын басыңыз.',
        'booking.phoneLabel': 'Телефон:',
        'booking.freeSlots': 'Бош слоттор',
        'booking.today': 'Бүгүн',
        'booking.tomorrow': 'Эртең',
        'booking.nav.back': '← Артка',
        'booking.nav.next': 'Улантуу →',

        // Home page
        'home.title': 'Кызматты табыңыз',
        'home.subtitle': 'Ош шаарындагы салондорго жана студияларга бир нече клик менен жазылыңыз — чалуусуз жана жазышуусуз',
        'home.search.placeholder': 'Аталышы же дареги боюнча издөө...',
        'home.search.submit': 'Издөө',
        'home.search.reset': 'Тазалоо',
        'home.cats.title': 'Популярдуу категориялар:',
        'home.cats.all': 'Баары',
        'home.card.book': 'Жазылуу',
        'home.empty': 'Эч нерсе табылган жок',
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
        'booking.needAuth':
            'Для бронирования необходимо войти или зарегистрироваться. Нажмите кнопку «Войти» вверху страницы.',
        'booking.phoneLabel': 'Телефон:',
        'booking.freeSlots': 'Свободные слоты',
        'booking.today': 'Сегодня',
        'booking.tomorrow': 'Завтра',
        'booking.nav.back': '← Назад',
        'booking.nav.next': 'Далее →',

        // Home page
        'home.title': 'Найдите свой сервис',
        'home.subtitle': 'Запись в салоны и студии города Ош за пару кликов — без звонков и переписок',
        'home.search.placeholder': 'Поиск по названию или адресу...',
        'home.search.submit': 'Искать',
        'home.search.reset': 'Сброс',
        'home.cats.title': 'Популярные категории:',
        'home.cats.all': 'Все',
        'home.card.book': 'Записаться',
        'home.empty': 'Ничего не найдено',
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
        'booking.needAuth':
            'To make a booking you need to sign in or sign up. Click the “Sign in” button at the top of the page.',
        'booking.phoneLabel': 'Phone:',
        'booking.freeSlots': 'Available slots',
        'booking.today': 'Today',
        'booking.tomorrow': 'Tomorrow',
        'booking.nav.back': '← Back',
        'booking.nav.next': 'Next →',

        // Home page
        'home.title': 'Find your service',
        'home.subtitle': 'Book salons and studios in Osh in a few clicks — no calls or chats',
        'home.search.placeholder': 'Search by name or address...',
        'home.search.submit': 'Search',
        'home.search.reset': 'Reset',
        'home.cats.title': 'Popular categories:',
        'home.cats.all': 'All',
        'home.card.book': 'Book now',
        'home.empty': 'Nothing found',
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


