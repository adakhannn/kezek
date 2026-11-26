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

jest.mock('@/lib/requestAuthContext', () => ({
  ...jest.requireActual('@/lib/requestAuthContext'),
  resolveRequestAuthContext: jest.fn(),
}));

jest.mock('@/lib/businessManagerAccess', () => ({
  managerAccessToBusiness: jest.fn(),
}));

import { managerAccessToBusiness } from '@/lib/businessManagerAccess';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { runMarkAttendance } from '@/lib/markAttendanceService';

describe('markAttendanceHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRouteParamUuid as jest.Mock).mockResolvedValue('booking-1');
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-1', userId: 'manager-1' });
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
      actorId: 'manager-1',
      attended: true,
    });
    expect(response.status).toBe(200);
    expect(body.status).toBe('paid');
  });

  describe('Bearer caller (the app, O1)', () => {
    const bookingRead = (row: unknown, error: unknown = null) => {
      const builder = { select: jest.fn(() => builder), eq: jest.fn(() => builder), maybeSingle: jest.fn().mockResolvedValue({ data: row, error }) };
      const admin = { from: jest.fn(() => builder), rpc: jest.fn() };
      (getServiceClient as jest.Mock).mockReturnValue(admin);
      return admin;
    };
    const bearerRequest = () => new Request('http://localhost/api/bookings/booking-1/mark-attendance', {
      method: 'POST', headers: { Authorization: 'Bearer app-token' },
    });

    beforeEach(() => {
      (resolveRequestAuthContext as jest.Mock).mockResolvedValue({ user: { id: 'user-1' }, supabase: {}, authSource: 'bearer' });
      (validateRequest as jest.Mock).mockResolvedValue({ success: true, data: { attended: false } });
      (runMarkAttendance as jest.Mock).mockResolvedValue({ ok: true, payload: { status: 'no_show' } });
    });

    test('a manager of the business of the booking marks it, acting for that business, without the cookie context', async () => {
      const admin = bookingRead({ biz_id: 'biz-9' });
      (managerAccessToBusiness as jest.Mock).mockResolvedValue('manager');
      const response = await runMarkAttendanceHttp(bearerRequest(), {});
      expect(response.status).toBe(200);
      expect(getBizContextForManagers).not.toHaveBeenCalled();
      expect(managerAccessToBusiness).toHaveBeenCalledWith(admin, 'user-1', 'biz-9');
      expect(runMarkAttendance).toHaveBeenCalledWith(expect.objectContaining({ bizId: 'biz-9', actorId: 'user-1', attended: false }));
    });

    test('someone who does not manage the business gets 403 and nothing is marked', async () => {
      bookingRead({ biz_id: 'biz-9' });
      (managerAccessToBusiness as jest.Mock).mockResolvedValue('none');
      const response = await runMarkAttendanceHttp(bearerRequest(), {});
      expect(response.status).toBe(403);
      expect(runMarkAttendance).not.toHaveBeenCalled();
    });

    test('a missing booking is 404, a failed read 500, an invalid token 401', async () => {
      bookingRead(null);
      expect((await runMarkAttendanceHttp(bearerRequest(), {})).status).toBe(404);
      bookingRead(null, { message: 'down' });
      expect((await runMarkAttendanceHttp(bearerRequest(), {})).status).toBe(500);
      const { NextResponse: Response } = jest.requireActual('next/server');
      (resolveRequestAuthContext as jest.Mock).mockResolvedValue(Response.json({ ok: false }, { status: 401 }));
      expect((await runMarkAttendanceHttp(bearerRequest(), {})).status).toBe(401);
      expect(runMarkAttendance).not.toHaveBeenCalled();
    });
  });
});
