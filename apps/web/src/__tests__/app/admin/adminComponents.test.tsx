import { renderToStaticMarkup } from 'react-dom/server';

import { AdminBookingStatusBadge, AdminStatusBadge } from '@/app/admin/AdminBadges';
import { AdminMetricCard } from '@/app/admin/AdminMetricCard';

describe('admin components', () => {
    test('AdminStatusBadge renders configured status label and count', () => {
        const html = renderToStaticMarkup(<AdminStatusBadge status="confirmed" count={7} />);

        expect(html).toContain('Подтверждено');
        expect(html).toContain('7');
    });

    test('AdminBookingStatusBadge falls back to raw status for unknown value', () => {
        const html = renderToStaticMarkup(<AdminBookingStatusBadge status="custom_status" />);

        expect(html).toContain('custom_status');
    });

    test('AdminMetricCard renders title and localized numeric value', () => {
        const html = renderToStaticMarkup(
            <AdminMetricCard
                title="Бизнесы"
                value={12345}
                gradient="from-blue-500 to-cyan-500"
                icon={<span>icon</span>}
            />
        );

        expect(html).toContain('Бизнесы');
        expect(html).toContain('12');
        expect(html).toContain('345');
    });
});
