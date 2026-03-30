import { NextResponse } from 'next/server';

import { runMarkAttendanceHttp } from '@/lib/markAttendanceHttpService';

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
  getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/validation/apiValidation', () => ({
  validateRequest: jest.fn(),
}));

jest.mock('@/lib/markAttendanceService', () => ({
  runMarkAttendance: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { runMarkAttendance } from '@/lib/markAttendanceService';

describe('markAttendanceHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRouteParamUuid as jest.Mock).mockResolvedValue('booking-1');
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-1' });
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn(), rpc: jest.fn() });
  });

  test('returns validation response as-is', async () => {
    (validateRequest as jest.Mock).mockResolvedValue({
      success: false,
      response: NextResponse.json({ ok: false, error: 'validation' }, { status: 400 }),
    });

    const response = await runMarkAttendanceHttp(
      new Request('http://localhost/api/bookings/booking-1/mark-attendance', { method: 'POST' }),
      { params: { id: 'booking-1' } },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });

  test('delegates validated request to mark attendance service', async () => {
    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { attended: true },
    });
    (runMarkAttendance as jest.Mock).mockResolvedValue({
      ok: true,
      payload: { status: 'paid' },
    });

    const response = await runMarkAttendanceHttp(
      new Request('http://localhost/api/bookings/booking-1/mark-attendance', { method: 'POST' }),
      { params: { id: 'booking-1' } },
    );
    const body = await response.json();

    expect(runMarkAttendance).toHaveBeenCalledWith({
      admin: { from: expect.any(Function), rpc: expect.any(Function) },
      bookingId: 'booking-1',
      bizId: 'biz-1',
      attended: true,
    });
    expect(response.status).toBe(200);
    expect(body.status).toBe('paid');
  });
});
