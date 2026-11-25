import type { pushRu } from './push.ru';

export const pushKy: Record<keyof typeof pushRu, string> = {
    'push.switch.label': 'Push-билдирмелер',
    'push.switch.hint': 'Ушул телефондо жазылуунун ырасталышы, жокко чыгарылышы жана эскертмелер',
    'push.denied.title': 'Билдирмелер өчүрүлгөн',
    'push.denied.message': 'Телефондун жөндөөлөрүнөн Kezek үчүн билдирмелерге уруксат бериңиз.',
    'push.denied.openSettings': 'Жөндөөлөрдү ачуу',
    'push.unsupported': 'Push-билдирмелер телефондогу Kezek колдонмосунда гана иштейт.',
    'push.error': 'Жөндөөнү өзгөртүү мүмкүн болгон жок. Интернетти текшерип, кайра аракет кылыңыз.',
};
