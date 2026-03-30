export function getWhatsAppTestSnapshot(env: NodeJS.ProcessEnv) {
    const accessToken = env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    const verifyToken = env.WHATSAPP_VERIFY_TOKEN;

    const hasToken = Boolean(accessToken);
    const hasPhoneId = Boolean(phoneNumberId);
    const hasVerifyToken = Boolean(verifyToken);

    const tokenPreview = accessToken
        ? `${accessToken.slice(0, 10)}...${accessToken.slice(-5)}`
        : 'не установлен';

    const resolvedPhoneId = phoneNumberId || 'не установлен';
    const tokenLength = accessToken?.length || 0;
    const phoneIdIsValid =
        resolvedPhoneId !== 'не установлен' && /^\d+$/.test(resolvedPhoneId);

    return {
        configured: hasToken && hasPhoneId && phoneIdIsValid,
        details: {
            WHATSAPP_ACCESS_TOKEN: hasToken
                ? `${tokenPreview} (${tokenLength} символов)`
                : 'не установлен',
            WHATSAPP_PHONE_NUMBER_ID: resolvedPhoneId,
            WHATSAPP_PHONE_NUMBER_ID_VALID: phoneIdIsValid,
            WHATSAPP_VERIFY_TOKEN: hasVerifyToken ? 'установлен' : 'не установлен',
        },
        message:
            hasToken && hasPhoneId && phoneIdIsValid
                ? 'WhatsApp настроен правильно'
                : hasToken && hasPhoneId && !phoneIdIsValid
                  ? 'WHATSAPP_PHONE_NUMBER_ID должен быть числом (например: 1185726307058446)'
                  : 'WhatsApp не настроен: проверьте переменные окружения',
        troubleshooting: {
            'Object with ID does not exist': [
                '1. Проверьте, что WHATSAPP_PHONE_NUMBER_ID правильный (найдите в Meta Developers -> WhatsApp -> API Setup)',
                '2. Убедитесь, что Phone Number ID связан с вашим WhatsApp Business Account',
                '3. Проверьте, что WHATSAPP_ACCESS_TOKEN имеет права на отправку сообщений',
                '4. Убедитесь, что номер телефона добавлен в WhatsApp Business Account',
            ],
        },
    };
}
