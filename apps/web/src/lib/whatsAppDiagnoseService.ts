import { logError } from '@/lib/log';

type GraphFetchResponse = {
    ok: boolean;
    json: () => Promise<unknown>;
    text: () => Promise<string>;
};

type GraphFetch = (url: string, init?: RequestInit) => Promise<GraphFetchResponse>;

type BusinessAccount = {
    id: string;
    name?: string;
};

type PhoneRecord = {
    id?: string;
    verified_name?: string | null;
    code_verification_status?: string;
    [key: string]: unknown;
};

type DiagnoseInput = {
    accessToken: string;
    phoneNumberId?: string;
    fetchImpl?: GraphFetch;
};

type DiagnoseState = {
    tokenCheck: unknown;
    businessAccounts: unknown;
    phoneNumbers: unknown;
    currentPhoneNumberId: unknown;
    recommendations: string[];
};

function createAuthHeaders(accessToken: string) {
    return {
        Authorization: `Bearer ${accessToken}`,
    };
}

async function graphFetchJson(fetchImpl: GraphFetch, url: string, accessToken: string) {
    const response = await fetchImpl(url, {
        headers: createAuthHeaders(accessToken),
    });

    return response;
}

function isBusinessAccountArray(value: unknown): value is BusinessAccount[] {
    return Array.isArray(value);
}

function isPhoneRecord(value: unknown): value is PhoneRecord {
    return typeof value === 'object' && value !== null;
}

export async function diagnoseWhatsAppSetup({
    accessToken,
    phoneNumberId,
    fetchImpl = fetch as unknown as GraphFetch,
}: DiagnoseInput) {
    const results: DiagnoseState = {
        tokenCheck: null,
        businessAccounts: null,
        phoneNumbers: null,
        currentPhoneNumberId: null,
        recommendations: [],
    };

    try {
        const meResp = await graphFetchJson(fetchImpl, 'https://graph.facebook.com/v21.0/me', accessToken);

        if (meResp.ok) {
            const meData = await meResp.json();
            results.tokenCheck = {
                ok: true,
                data: meData,
                message: 'Токен валиден',
            };
        } else {
            results.tokenCheck = {
                ok: false,
                error: await meResp.text(),
                message: 'Токен невалиден или истек',
            };
            results.recommendations.push('Проверь WHATSAPP_ACCESS_TOKEN - токен может быть неверным или истекшим');
        }
    } catch (error) {
        results.tokenCheck = {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }

    try {
        const accountsResp = await graphFetchJson(fetchImpl, 'https://graph.facebook.com/v21.0/me/businesses', accessToken);

        if (!accountsResp.ok) {
            results.businessAccounts = {
                ok: false,
                error: await accountsResp.text(),
                message: 'Не удалось получить бизнес-аккаунты',
            };
            results.recommendations.push(
                'Токен не имеет разрешения business_management. Добавь это разрешение при генерации токена.'
            );

            return buildSummary(results);
        }

        const accountsData = (await accountsResp.json()) as { data?: BusinessAccount[] };
        const businessAccounts = isBusinessAccountArray(accountsData.data) ? accountsData.data : [];
        results.businessAccounts = {
            ok: true,
            accounts: businessAccounts,
            message: `Найдено ${businessAccounts.length} бизнес-аккаунт(ов)`,
        };

        const allPhoneNumbers: PhoneRecord[] = [];

        for (const account of businessAccounts) {
            try {
                const phonesResp = await graphFetchJson(
                    fetchImpl,
                    `https://graph.facebook.com/v21.0/${account.id}/phone_numbers`,
                    accessToken
                );

                if (!phonesResp.ok) {
                    continue;
                }

                const phonesData = (await phonesResp.json()) as { data?: PhoneRecord[] };
                const phoneRecords = Array.isArray(phonesData.data) ? phonesData.data : [];

                for (const phone of phoneRecords) {
                    allPhoneNumbers.push({
                        ...phone,
                        businessAccountId: account.id,
                        businessAccountName: account.name,
                    });
                }
            } catch (error) {
                logError('WhatsAppDiagnose', 'Error fetching phones for account', {
                    accountId: account.id,
                    error,
                });
            }
        }

        results.phoneNumbers = {
            ok: true,
            phones: allPhoneNumbers,
            message: `Найдено ${allPhoneNumbers.length} номер(ов)`,
        };

        applyCurrentPhoneDiagnostics(results, allPhoneNumbers, phoneNumberId);
        applyRegistrationRecommendations(results, allPhoneNumbers, phoneNumberId);
    } catch (error) {
        results.businessAccounts = {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }

    return buildSummary(results);
}

function applyCurrentPhoneDiagnostics(results: DiagnoseState, allPhoneNumbers: PhoneRecord[], phoneNumberId?: string) {
    if (!phoneNumberId) {
        results.currentPhoneNumberId = {
            ok: false,
            message: 'WHATSAPP_PHONE_NUMBER_ID не установлен',
        };
        results.recommendations.push('Установи WHATSAPP_PHONE_NUMBER_ID в переменных окружения');
        return;
    }

    const foundPhone = allPhoneNumbers.find((phone) => String(phone.id) === String(phoneNumberId));

    if (foundPhone) {
        results.currentPhoneNumberId = {
            ok: true,
            phone: foundPhone,
            message: 'Phone Number ID найден и соответствует номеру',
        };
        return;
    }

    results.currentPhoneNumberId = {
        ok: false,
        phoneNumberId,
        message: 'Phone Number ID не найден в списке номеров',
    };
    results.recommendations.push(
        `WHATSAPP_PHONE_NUMBER_ID=${phoneNumberId} не соответствует ни одному зарегистрированному номеру. Используй один из ID из списка выше.`
    );
}

function applyRegistrationRecommendations(results: DiagnoseState, allPhoneNumbers: PhoneRecord[], phoneNumberId?: string) {
    const registeredPhones = allPhoneNumbers.filter((phone) => phone.verified_name !== null && phone.verified_name !== undefined);

    if (registeredPhones.length === 0) {
        results.recommendations.push(
            'Не найдено зарегистрированных номеров. Убедись, что номер телефона зарегистрирован в WhatsApp Business Account через WhatsApp Manager.'
        );
    }

    const currentPhoneOk =
        typeof results.currentPhoneNumberId === 'object' &&
        results.currentPhoneNumberId !== null &&
        'ok' in results.currentPhoneNumberId &&
        results.currentPhoneNumberId.ok === true &&
        'phone' in results.currentPhoneNumberId &&
        isPhoneRecord(results.currentPhoneNumberId.phone)
            ? results.currentPhoneNumberId.phone
            : null;

    if (currentPhoneOk) {
        if (currentPhoneOk.code_verification_status === 'NOT_VERIFIED') {
            results.recommendations.push(
                'Номер не верифицирован (code_verification_status: NOT_VERIFIED). Это может вызывать ошибку "Account not registered". Запроси верификацию номера в WhatsApp Manager или дождись завершения процесса регистрации.'
            );
        }

        if (!currentPhoneOk.verified_name) {
            results.recommendations.push(
                'У номера нет verified_name. Номер может быть не полностью зарегистрирован. Проверь статус номера в WhatsApp Manager - он должен быть "Подключено" (CONNECTED).'
            );
        }

        return;
    }

    if (phoneNumberId) {
        results.recommendations.push(
            `WHATSAPP_PHONE_NUMBER_ID=${phoneNumberId} не найден в списке зарегистрированных номеров. Это может вызывать ошибку "Account not registered". Проверь правильность Phone Number ID через Graph API Explorer: /me/businesses -> выбери Business Account -> /business_account_id/phone_numbers. Используй поле id из ответа.`
        );
    }
}

function buildSummary(results: DiagnoseState) {
    const hasPhones =
        typeof results.phoneNumbers === 'object' &&
        results.phoneNumbers !== null &&
        'phones' in results.phoneNumbers &&
        Array.isArray(results.phoneNumbers.phones) &&
        results.phoneNumbers.phones.length > 0;

    const summary = {
        tokenValid:
            typeof results.tokenCheck === 'object' &&
            results.tokenCheck !== null &&
            'ok' in results.tokenCheck &&
            results.tokenCheck.ok === true,
        hasBusinessAccounts:
            typeof results.businessAccounts === 'object' &&
            results.businessAccounts !== null &&
            'ok' in results.businessAccounts &&
            results.businessAccounts.ok === true,
        hasPhoneNumbers: hasPhones,
        phoneNumberIdValid:
            typeof results.currentPhoneNumberId === 'object' &&
            results.currentPhoneNumberId !== null &&
            'ok' in results.currentPhoneNumberId &&
            results.currentPhoneNumberId.ok === true,
    };

    return {
        ...results,
        summary,
    };
}
