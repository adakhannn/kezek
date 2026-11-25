'use client';

import { BUSINESS_TIME_ZONE_OPTIONS, formatUtcOffset, isValidTimeZone } from '@shared-client/timezone';
import { useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';

/** The business's own time zone (businesses.tz, ARCH-11); `initial` is the resolved current zone. */
export function BusinessTimeZoneSettingsForm({ initial }: { initial: string }) {
    const { t } = useLanguage();
    const [tz, setTz] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ variant: 'success' | 'danger'; text: string } | null>(null);

    // The current zone stays selectable even when the short list does not contain it.
    const options = useMemo(() => {
        const known = BUSINESS_TIME_ZONE_OPTIONS.filter((zone) => isValidTimeZone(zone));
        return known.includes(saved) ? known : [saved, ...known];
    }, [saved]);

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const response = await fetch('/api/dashboard/contact-settings', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ tz }),
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                setMessage({
                    variant: 'danger',
                    text: payload.error === 'tz_has_future_bookings' ? t('business.timeZoneSettings.futureBookings')
                        : typeof payload.message === 'string' ? payload.message
                        : typeof payload.error?.message === 'string' ? payload.error.message
                        : t('business.timeZoneSettings.saveError'),
                });
                return;
            }
            const next = typeof payload.data?.tz === 'string' ? payload.data.tz : tz;
            setTz(next);
            setSaved(next);
            setMessage({ variant: 'success', text: t('business.timeZoneSettings.saved') });
        } catch {
            setMessage({ variant: 'danger', text: t('business.contactSettings.networkError') });
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            {message ? <AlertBanner variant={message.variant} message={message.text} /> : null}

            <Card variant="elevated" padding="lg">
                <div className="mb-5">
                    <h2 className="type-section-title text-[var(--text-primary)]">{t('business.timeZoneSettings.heading')}</h2>
                    <p className="type-body mt-1 text-[var(--text-secondary)]">
                        {t('business.timeZoneSettings.description')}
                    </p>
                </div>
                <Select
                    label={t('business.timeZoneSettings.label')}
                    value={tz}
                    onChange={(event) => setTz(event.target.value)}
                    helperText={t('business.timeZoneSettings.hint')}
                >
                    {options.map((zone) => (
                        <option key={zone} value={zone}>
                            {`${zone} (${formatUtcOffset(zone)})`}
                        </option>
                    ))}
                </Select>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" isLoading={saving} disabled={saving || tz === saved}>
                    {t('business.timeZoneSettings.save')}
                </Button>
            </div>
        </form>
    );
}
