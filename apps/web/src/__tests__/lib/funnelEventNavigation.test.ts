/** @jest-environment jsdom */
import { trackFunnelEvent } from '@/lib/funnelEvents';

it('keeps a small success event alive across receipt navigation', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await trackFunnelEvent({ event_type: 'booking_success', source: 'public', biz_id: 'biz', booking_id: 'created-id', session_id: 'anonymous-session' });
    expect(fetch).toHaveBeenCalledWith('/api/funnel-events', expect.objectContaining({ method: 'POST', keepalive: true }));
    const request = jest.mocked(fetch).mock.calls[0][1];
    expect(JSON.parse(request?.body as string)).toMatchObject({ booking_id: 'created-id', session_id: 'anonymous-session', timestamp: expect.any(String) });
});
