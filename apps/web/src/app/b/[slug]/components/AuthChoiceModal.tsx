'use client';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

type AuthChoiceModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onAuth: () => void;
    onGuestBooking: () => void;
    t: (key: string, fallback?: string) => string;
    slotTimeLabel?: string | null;
};

export function AuthChoiceModal({
    isOpen,
    onClose,
    onAuth,
    onGuestBooking,
    t,
    slotTimeLabel,
}: AuthChoiceModalProps) {
    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            title={t('booking.authChoice.title', 'Как продолжить запись')}
            description={t(
                'booking.authChoice.subtitle',
                'Вы уже выбрали слот. Теперь можно войти в аккаунт или продолжить как гость.',
            )}
            size="lg"
            footer={
                <div className="flex items-center justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                        {t('booking.authChoice.cancel', 'Отмена')}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                {slotTimeLabel ? (
                    <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-4 py-3">
                        <div className="type-caption text-[var(--text-secondary)]">
                            {t('booking.authChoice.selectedSlot', 'Выбранный слот')}
                        </div>
                        <div className="type-label mt-1 text-[var(--text-primary)]">{slotTimeLabel}</div>
                    </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onAuth();
                        }}
                        className="rounded-[22px] border border-[var(--accent-primary)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)] p-4 text-left transition-all hover:shadow-[var(--shadow-sm)]"
                    >
                        <div className="type-label text-[var(--accent-primary)]">
                            {t('booking.authChoice.authBadge', 'Через аккаунт')}
                        </div>
                        <div className="type-section-title mt-2 text-[var(--text-primary)]">
                            {t('booking.authChoice.authButton', 'Войти и завершить')}
                        </div>
                        <p className="type-caption mt-2 text-[var(--text-secondary)]">
                            {t('booking.authChoice.authHint', 'Подойдёт, если вы хотите управлять записью в кабинете и видеть историю визитов.')}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onGuestBooking();
                        }}
                        className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-left transition-all hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-sm)]"
                    >
                        <div className="type-label text-[var(--text-secondary)]">
                            {t('booking.authChoice.guestBadge', 'Как гость')}
                        </div>
                        <div className="type-section-title mt-2 text-[var(--text-primary)]">
                            {t('booking.authChoice.guestButton', 'Продолжить без аккаунта')}
                        </div>
                        <p className="type-caption mt-2 text-[var(--text-secondary)]">
                            {t('booking.authChoice.guestHint', 'Понадобятся только имя и телефон, чтобы быстро подтвердить бронь.')}
                        </p>
                    </button>
                </div>

                <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-4 py-3">
                    <p className="type-caption text-[var(--text-secondary)]">
                        {t('booking.authChoice.footerHint', 'Оба сценария приведут к одной и той же записи. Разница только в способе подтверждения и дальнейшем управлении.')}
                    </p>
                </div>
            </div>
        </Dialog>
    );
}
