type Translate = (key: string, fallback?: string) => string;

/** Keep API machine codes separate from user-facing, localized validation copy. */
export function promotionSaveErrorMessage(response: unknown, t: Translate): string {
    const payload = response && typeof response === 'object'
        ? response as { error?: unknown; details?: { field?: unknown } | null }
        : null;
    if (payload?.error === 'validation') {
        if (payload.details?.field === 'params.visit_count') {
            return t('branches.promotions.validation.visitCount', 'Количество визитов должно быть больше 0');
        }
        if (payload.details?.field === 'params.discount_percent') {
            return t('branches.promotions.validation.discount', 'Процент скидки должен быть от 1 до 100');
        }
        return t('branches.promotions.validation.general', 'Проверьте параметры акции и попробуйте снова');
    }
    return t('branches.promotions.error.save', 'Ошибка сохранения акции');
}
