import { createBranch, type BranchCreateAdminLike } from '@/lib/branchCreateService';

describe('branchCreateService', () => {
  function createAdmin() {
    return {
      from: jest.fn(),
    } as unknown as jest.Mocked<BranchCreateAdminLike>;
  }

  test('rejects missing name', async () => {
    const admin = createAdmin();

    const result = await createBranch({
      admin,
      bizId: 'biz-id',
      body: {} as never,
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'Название филиала обязательно',
      status: 400,
    });
  });

  test('rejects invalid coordinates', async () => {
    const admin = createAdmin();

    const result = await createBranch({
      admin,
      bizId: 'biz-id',
      body: {
        name: 'Test Branch',
        lat: 200,
        lon: 200,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'Некорректные координаты',
      status: 400,
    });
  });

  test('creates branch successfully', async () => {
    const admin = createAdmin();
    const noBranch = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const noApplication = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    admin.from.mockReturnValueOnce(noBranch).mockReturnValueOnce(noApplication);
    admin.from.mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'branch-id' },
        error: null,
      }),
    });

    const result = await createBranch({
      admin,
      bizId: 'biz-id',
      body: {
        name: ' Test Branch ',
        address: 'Address',
        is_active: true,
      },
    });

    expect(result).toEqual({
      ok: true,
      data: { id: 'branch-id' },
    });
  });

  test('returns a clear conflict when the business branch limit is reached', async () => {
    const admin = createAdmin();
    const noBranch = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const noApplication = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    admin.from.mockReturnValueOnce(noBranch).mockReturnValueOnce(noApplication);
    admin.from.mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'BRANCH_LIMIT_REACHED:2:2' },
      }),
    });

    const result = await createBranch({
      admin,
      bizId: 'biz-id',
      body: { name: 'Third Branch' },
    });

    expect(result).toEqual({
      ok: false,
      error: 'conflict',
      message: 'Достигнут лимит филиалов: 2 из 2. Обратитесь к суперадминистратору для увеличения лимита.',
      status: 409,
    });
  });

  test('copies submitted directory links to the first branch when no links are entered manually', async () => {
    const admin = createAdmin();
    const insert = jest.fn().mockReturnThis();
    admin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          directory_links: {
            instagram: 'https://instagram.com/example',
            two_gis: null,
            google_maps: 'https://maps.google.com/example',
            yandex_maps: null,
          },
        },
        error: null,
      }),
    }).mockReturnValueOnce({
      insert,
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'branch-id' }, error: null }),
    });

    const result = await createBranch({
      admin,
      bizId: 'biz-id',
      body: { name: 'First Branch' },
    });

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      directory_links: {
        instagram: 'https://instagram.com/example',
        two_gis: null,
        google_maps: 'https://maps.google.com/example',
        yandex_maps: null,
      },
    }));
  });
});
