// Server messages (FE-10): each value is the exact Russian text a service returns in an API response, or a
// pattern of it with {placeholders}; ky and en translate it. Not part of the client bundle: only
// src/lib/serverMessages.ts imports these, to answer in the language of the request.
export const serverCommonKy = {
    'server.common.staffSelectionRequired': 'Кызматкердин кабинетинде бизнести тандаңыз',
    'server.common.noStaffAccess': 'Кызматкердин кабинетине кирүү мүмкүн эмес',
    'server.common.accessDenied': 'Кирүү мүмкүн эмес',
    'server.common.dataConflict': 'Маалыматтар бири-бирине карама-каршы келет',
    'server.common.validationError': 'Маалыматтарды текшерүүдө ката',
    'server.common.notAuthorized': 'Сиз системага кире элексиз',
    'server.common.authUnavailable': 'Кирүү кызматы убактылуу иштебей турат. Кийинчерээк кайталаңыз.',
    'server.common.noBusinessAccess': 'Бул бизнеске кирүү мүмкүн эмес',
    'server.common.notFound': 'Маалымат табылган жок',
    'server.common.internalError': 'Сервердин ички катасы',
    'server.common.rateLimitUnavailable': 'Чектөөлөрдү текшерүү убактылуу иштебей турат. Кийинчерээк кайталаңыз.',
    'server.common.rateLimited': 'Суроо-талаптар өтө көп. {seconds} секунддан кийин кайра аракет кылыңыз.',
    'server.common.authRequired': 'Системага кирүү талап кылынат',
    'server.common.noManagerAccess': 'Башкаруу кабинетине кирүү мүмкүн эмес',
    'server.common.staffIdMissing': 'Кызматкердин ID көрсөтүлгөн жок',
    'server.common.staffNotFoundOrForbidden': 'Кызматкер табылган жок же кирүү мүмкүн эмес',
    'server.common.localeInvalid': 'Белгисиз тил: ru, ky же en гана болот',
    'server.common.loadFailed': 'Маалыматты жүктөө мүмкүн болгон жок. Кайра аракет кылыңыз.',
    'server.common.saveFailed': 'Өзгөртүүлөрдү сактоо мүмкүн болгон жок. Кайра аракет кылыңыз.',
    'server.common.deleteFailed': 'Өчүрүү мүмкүн болгон жок. Кайра аракет кылыңыз.',
    'server.common.dnsLookupFailed': 'Сайттын сервери маалымат базасынын дарегин таба алган жок.',
} as const;
