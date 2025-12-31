// apps/web/src/app/api/whatsapp/diagnose/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * GET /api/whatsapp/diagnose
 * Полная диагностика WhatsApp API: проверяет токен, получает все аккаунты и номера
 */
export async function GET() {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (!accessToken) {
            return NextResponse.json({
                ok: false,
                error: 'no_token',
                message: 'WHATSAPP_ACCESS_TOKEN не установлен',
            }, { status: 500 });
        }

        const results: {
            tokenCheck: unknown;
            businessAccounts: unknown;
            phoneNumbers: unknown;
            currentPhoneNumberId: unknown;
            recommendations: string[];
        } = {
            tokenCheck: null,
            businessAccounts: null,
            phoneNumbers: null,
            currentPhoneNumberId: null,
            recommendations: [],
        };

        // 1. Проверка токена (получаем информацию о пользователе)
        try {
            const meResp = await fetch('https://graph.facebook.com/v21.0/me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (meResp.ok) {
                const meData = await meResp.json();
                results.tokenCheck = {
                    ok: true,
                    data: meData,
                    message: 'Токен валиден',
                };
            } else {
                const errText = await meResp.text();
                results.tokenCheck = {
                    ok: false,
                    error: await meResp.text(),
                    message: 'Токен невалиден или истек',
                };
                results.recommendations.push('Проверь WHATSAPP_ACCESS_TOKEN - токен может быть неверным или истекшим');
            }
        } catch (e) {
            results.tokenCheck = {
                ok: false,
                error: e instanceof Error ? e.message : String(e),
            };
        }

        // 2. Получаем Business Accounts
        try {
            const accountsResp = await fetch('https://graph.facebook.com/v21.0/me/businesses', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (accountsResp.ok) {
                const accountsData = await accountsResp.json();
                results.businessAccounts = {
                    ok: true,
                    accounts: accountsData.data || [],
                    message: `Найдено ${accountsData.data?.length || 0} бизнес-аккаунт(ов)`,
                };

                // 3. Для каждого аккаунта получаем номера телефонов
                const allPhoneNumbers: unknown[] = [];
                
                if (accountsData.data && Array.isArray(accountsData.data)) {
                    for (const account of accountsData.data) {
                        try {
                            const phonesResp = await fetch(
                                `https://graph.facebook.com/v21.0/${account.id}/phone_numbers`,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                    },
                                }
                            );

                            if (phonesResp.ok) {
                                const phonesData = await phonesResp.json();
                                if (phonesData.data && Array.isArray(phonesData.data)) {
                                    for (const phone of phonesData.data) {
                                        allPhoneNumbers.push({
                                            ...phone,
                                            businessAccountId: account.id,
                                            businessAccountName: account.name,
                                        });
                                    }
                                }
                            }
                        } catch (e) {
                            // Игнорируем ошибки для отдельных аккаунтов
                            console.error(`[whatsapp/diagnose] Error fetching phones for account ${account.id}:`, e);
                        }
                    }
                }

                results.phoneNumbers = {
                    ok: true,
                    phones: allPhoneNumbers,
                    message: `Найдено ${allPhoneNumbers.length} номер(ов)`,
                };

                // 4. Проверяем текущий Phone Number ID
                if (phoneNumberId) {
                    const foundPhone = allPhoneNumbers.find(
                        (p: unknown) => 
                            typeof p === 'object' && 
                            p !== null && 
                            'id' in p && 
                            String(p.id) === String(phoneNumberId)
                    );

                    if (foundPhone) {
                        results.currentPhoneNumberId = {
                            ok: true,
                            phone: foundPhone,
                            message: 'Phone Number ID найден и соответствует номеру',
                        };
                    } else {
                        results.currentPhoneNumberId = {
                            ok: false,
                            phoneNumberId,
                            message: 'Phone Number ID не найден в списке номеров',
                        };
                        results.recommendations.push(
                            `WHATSAPP_PHONE_NUMBER_ID=${phoneNumberId} не соответствует ни одному зарегистрированному номеру. ` +
                            `Используй один из ID из списка выше.`
                        );
                    }
                } else {
                    results.currentPhoneNumberId = {
                        ok: false,
                        message: 'WHATSAPP_PHONE_NUMBER_ID не установлен',
                    };
                    results.recommendations.push('Установи WHATSAPP_PHONE_NUMBER_ID в переменных окружения');
                }

                // 5. Проверяем статус номеров
                const registeredPhones = allPhoneNumbers.filter(
                    (p: unknown) => 
                        typeof p === 'object' && 
                        p !== null && 
                        'verified_name' in p &&
                        p.verified_name !== null
                );

                if (registeredPhones.length === 0) {
                    results.recommendations.push(
                        'Не найдено зарегистрированных номеров. ' +
                        'Убедись, что номер телефона зарегистрирован в WhatsApp Business Account через WhatsApp Manager.'
                    );
                }

            } else {
                const errText = await accountsResp.text();
                results.businessAccounts = {
                    ok: false,
                    error: errText,
                    message: 'Не удалось получить бизнес-аккаунты',
                };
                results.recommendations.push(
                    'Токен не имеет разрешения business_management. ' +
                    'Добавь это разрешение при генерации токена.'
                );
            }
        } catch (e) {
            results.businessAccounts = {
                ok: false,
                error: e instanceof Error ? e.message : String(e),
            };
        }

        return NextResponse.json({
            ok: true,
            ...results,
            summary: {
                tokenValid: results.tokenCheck && typeof results.tokenCheck === 'object' && 'ok' in results.tokenCheck && results.tokenCheck.ok === true,
                hasBusinessAccounts: results.businessAccounts && typeof results.businessAccounts === 'object' && 'ok' in results.businessAccounts && results.businessAccounts.ok === true,
                hasPhoneNumbers: results.phoneNumbers && typeof results.phoneNumbers === 'object' && 'phones' in results.phoneNumbers && Array.isArray(results.phoneNumbers.phones) && results.phoneNumbers.phones.length > 0,
                phoneNumberIdValid: results.currentPhoneNumberId && typeof results.currentPhoneNumberId === 'object' && 'ok' in results.currentPhoneNumberId && results.currentPhoneNumberId.ok === true,
            },
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[whatsapp/diagnose] error:', e);
        return NextResponse.json(
            { ok: false, error: 'internal', message: msg },
            { status: 500 }
        );
    }
}

