jest.mock('@/lib/requestAuthContext', () => ({
  resolveRequestAuthContext: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/profileUpdateService', () => ({
  updateProfileSettings: jest.fn(),
}));

import { NextResponse } from 'next/server';

import { runProfileUpdateHttp } from '@/lib/profileUpdateHttpService';
import { updateProfileSettings } from '@/lib/profileUpdateService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

function request(body: string) {
  return new Request('http://localhost/api/profile/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

describe('profileUpdateHttpService', () => {
  const userClient = { auth: { getUser: jest.fn() }, from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (resolveRequestAuthContext as jest.Mock).mockResolvedValue({
      supabase: userClient,
      user: { id: 'user-1' },
      authSource: 'cookie',
    });
  });

  test('delegates a cookie session to the profile service', async () => {
    (updateProfileSettings as jest.Mock).mockResolvedValue({ ok: true, data: undefined });

    const response = await runProfileUpdateHttp(request(JSON.stringify({ full_name: 'Ada' })));
    const body = await response.json();

    expect(updateProfileSettings).toHaveBeenCalledWith({
      supabase: userClient,
      body: { full_name: 'Ada' },
      updateFullNameMetadata: undefined,
    });
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test('accepts a mobile bearer session and mirrors the name through a targeted admin merge', async () => {
    const updateUserById = jest.fn().mockResolvedValue({ error: null });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue({ auth: { admin: { updateUserById } } });
    (resolveRequestAuthContext as jest.Mock).mockResolvedValue({
      supabase: userClient,
      user: { id: 'user-1' },
      authSource: 'bearer',
    });
    (updateProfileSettings as jest.Mock).mockResolvedValue({ ok: true, data: undefined });

    await runProfileUpdateHttp(request(JSON.stringify({ full_name: 'Ada' })));

    const { updateFullNameMetadata } = (updateProfileSettings as jest.Mock).mock.calls[0][0];
    await updateFullNameMetadata('Ada');
    expect(updateUserById).toHaveBeenCalledWith('user-1', { user_metadata: { full_name: 'Ada' } });
  });

  test('returns the auth response unchanged when no session is present', async () => {
    (resolveRequestAuthContext as jest.Mock).mockResolvedValue(
      NextResponse.json({ ok: false, error: 'auth' }, { status: 401 }),
    );

    const response = await runProfileUpdateHttp(request(JSON.stringify({ full_name: 'Ada' })));

    expect(response.status).toBe(401);
    expect(updateProfileSettings).not.toHaveBeenCalled();
  });

  test('rejects invalid JSON', async () => {
    const response = await runProfileUpdateHttp(request('{'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
    expect(updateProfileSettings).not.toHaveBeenCalled();
  });

  test('maps service validation errors', async () => {
    (updateProfileSettings as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'validation',
      message: 'bad phone',
      status: 400,
    });

    const response = await runProfileUpdateHttp(request(JSON.stringify({ phone: 'bad' })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });
});
