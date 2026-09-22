export const schedulingRu = {
    'scheduling.transferHint': 'Изменится основной филиал. Уже назначенные рабочие дни и брони останутся в своих филиалах. Для работы в новом филиале отдельно опубликуйте график в карточке сотрудника.',
    'scheduling.start': 'Начало', 'scheduling.end': 'Окончание',
    'scheduling.add': 'Добавить интервал', 'scheduling.remove': 'Удалить',
    'scheduling.work': 'Рабочее время', 'scheduling.breaks': 'Перерывы',
    'scheduling.off': 'Выходной', 'scheduling.closed': 'Закрыто',
    'scheduling.invalid': 'Проверьте интервалы: начало раньше окончания, без пересечений, перерывы внутри рабочего времени.',
    'scheduling.branchHint': 'Задайте часы отдельно для каждого дня. Сохранение не назначает сотрудникам новый график.',
    'scheduling.previous': 'Предыдущие 14 дней', 'scheduling.next': 'Следующие 14 дней',
    'scheduling.today': 'Сегодня',
} as const;
export const schedulingKy: Record<keyof typeof schedulingRu, string> = {
    'scheduling.transferHint': 'Негизги филиал өзгөрөт. Дайындалган жумуш күндөрү жана кардарлардын жазылуулары өз филиалдарында калат. Жаңы филиалда иштөө үчүн кызматкердин карточкасында графикти өзүнчө жарыялаңыз.',
    'scheduling.start': 'Башталышы', 'scheduling.end': 'Аякташы',
    'scheduling.add': 'Убакыт аралыгын кошуу', 'scheduling.remove': 'Өчүрүү',
    'scheduling.work': 'Жумуш убактысы', 'scheduling.breaks': 'Тыныгуулар',
    'scheduling.off': 'Эс алуу күнү', 'scheduling.closed': 'Жабык',
    'scheduling.invalid': 'Убакыт аралыктарын текшериңиз: башталышы аякташынан эрте, аралыктар кесилишпейт, тыныгуулар жумуш убактысынын ичинде болушу керек.',
    'scheduling.branchHint': 'Ар бир күндүн иш убактысын өзүнчө белгилеңиз. Сактоо кызматкерлерге жаңы график дайындабайт.',
    'scheduling.previous': 'Мурунку 14 күн', 'scheduling.next': 'Кийинки 14 күн',
    'scheduling.today': 'Бүгүн',
};
export const schedulingEn: Record<keyof typeof schedulingRu, string> = {
    'scheduling.transferHint': 'The home branch will change. Assigned working days and bookings stay at their existing branches. Publish a separate schedule in the employee profile to assign work at the new branch.',
    'scheduling.start': 'Start', 'scheduling.end': 'End',
    'scheduling.add': 'Add interval', 'scheduling.remove': 'Remove',
    'scheduling.work': 'Working hours', 'scheduling.breaks': 'Breaks',
    'scheduling.off': 'Day off', 'scheduling.closed': 'Closed',
    'scheduling.invalid': 'Check intervals: start before end, no overlaps, and breaks within working hours.',
    'scheduling.branchHint': 'Set opening hours for each day. Saving does not assign a new schedule to employees.',
    'scheduling.previous': 'Previous 14 days', 'scheduling.next': 'Next 14 days',
    'scheduling.today': 'Today',
};
