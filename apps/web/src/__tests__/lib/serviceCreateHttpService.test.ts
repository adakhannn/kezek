import { runServiceCreateHttp } from '@/lib/serviceCreateHttpService';

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/serviceCreateRouteService', () => ({
  createServiceRouteEntry: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { createServiceRouteEntry } from '@/lib/serviceCreateRouteService';
import { getServiceClient } from '@/lib/supabaseService';

describe('serviceCreateHttpService', () => {
  const mockServiceClient = { from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-id' });
    (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
  });

  test('delegates valid request to service create flow', async () => {
    (createServiceRouteEntry as jest.Mock).mockResolvedValue({
      ok: true,
      data: { count: 1, ids: ['service-id'] },
    });

    const response = await runServiceCreateHttp(
      new Request('http://localhost/api/services/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name_ru: 'Massage',
          duration_min: 60,
          price_from: 1000,
          price_to: 1500,
          branch_ids: ['branch-1'],
        }),
      }),
    );
    const body = await response.json();

    expect(createServiceRouteEntry).toHaveBeenCalledWith({
      admin: mockServiceClient,
      bizId: 'biz-id',
      body: {
        name_ru: 'Massage',
        duration_min: 60,
        price_from: 1000,
        price_to: 1500,
        branch_ids: ['branch-1'],
      },
    });
    expect(response.status).toBe(200);
    expect(body.data.ids).toEqual(['service-id']);
  });

  test('maps service validation errors', async () => {
    (createServiceRouteEntry as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'validation',
      message: 'bad payload',
      status: 400,
      details: { field: 'name_ru' },
    });

    const response = await runServiceCreateHttp(
      new Request('http://localhost/api/services/create', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
    expect(body.details).toEqual({ field: 'name_ru' });
  });
});
