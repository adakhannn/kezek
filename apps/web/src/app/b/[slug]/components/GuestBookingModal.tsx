'use client';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';

type GuestBookingForm = {
    client_name: string;
    client_phone: string;
    client_email: string;
};

type GuestBookingModalProps = {
    isOpen: boolean;
    loading: boolean;
    form: GuestBookingForm;
    onClose: () => void;
    onFormChange: (form: GuestBookingForm) => void;
    onSubmit: () => void;
    t: (key: string, fallback?: string) => string;
    slotTimeLabel?: string | null;
};

export function GuestBookingModal({
    isOpen,
    loading,
    form,
    onClose,
    onFormChange,
    onSubmit,
    t,
    slotTimeLabel,
}: GuestBookingModalProps) {
    return (
        <Dialog
            open={isOpen}
            onClose={() => {
                if (!loading) onClose();
            }}
            dismissible={!loading}
            title={t('booking.guest.title', 'Гостевая запись')}
            description={t('booking.guest.subtitle', 'Оставьте короткие контакты, и система завершит бронирование без создания аккаунта.')}
            footer={
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
                        {t('booking.guest.cancel', 'Отмена')}
                    </Button>
                    <Button type="button" size="sm" onClick={onSubmit} isLoading={loading}>
                        {loading ? t('booking.guest.booking', 'Бронируем...') : t('booking.guest.book', 'Подтвердить запись')}
                    </Button>
                </div>
            }
        >
            <div className="space-y-3">
                {slotTimeLabel ? (
                    <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-4 py-3">
                        <div className="type-caption text-[var(--text-secondary)]">
                            {t('booking.guest.selectedSlot', 'Слот для подтверждения')}
                        </div>
                        <div className="type-label mt-1 text-[var(--text-primary)]">{slotTimeLabel}</div>
                    </div>
                ) : null}

                <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3">
                    <p className="type-caption text-[var(--text-secondary)]">
                        {t('booking.guest.info', 'Нам нужны только имя и телефон, чтобы создать и подтвердить запись. Email можно оставить по желанию.')}
                    </p>
                </div>

                <Input
                    label={`${t('booking.guest.name', 'Ваше имя')} *`}
                    value={form.client_name}
                    onChange={(e) => onFormChange({ ...form, client_name: e.target.value })}
                    helperText={t('booking.guest.nameHelper', 'Имя поможет сотруднику подтвердить, что запись оформлена на вас.')}
                    placeholder={t('booking.guest.namePlaceholder', 'Введите ваше имя')}
                    disabled={loading}
                    autoFocus
                />
                <Input
                    label={`${t('booking.guest.phone', 'Телефон')} *`}
                    type="tel"
                    value={form.client_phone}
                    onChange={(e) => onFormChange({ ...form, client_phone: e.target.value })}
                    helperText={t('booking.guest.phoneHelper', 'На этот номер придёт подтверждение или с вами свяжутся при необходимости.')}
                    placeholder={t('booking.guest.phonePlaceholder', '+996555123456')}
                    disabled={loading}
                />
                <Input
                    label={`${t('booking.guest.email', 'Email')} (${t('booking.guest.optional', 'необязательно')})`}
                    type="email"
                    value={form.client_email}
                    onChange={(e) => onFormChange({ ...form, client_email: e.target.value })}
                    helperText={t('booking.guest.emailHelper', 'Можно оставить, если хотите получить дополнительное подтверждение на почту.')}
                    placeholder={t('booking.guest.emailPlaceholder', 'you@example.com')}
                    disabled={loading}
                />
            </div>
        </Dialog>
    );
}
