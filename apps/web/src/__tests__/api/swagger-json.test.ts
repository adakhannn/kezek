/**
 * Интеграционные тесты для /api/swagger.json
 * Проверяет, что endpoint возвращает сгенерированный swaggerSpec в стандартном формате успешного ответа.
 */

import { GET } from '@/app/api/swagger.json/route';
import { expectSuccessResponse } from './testHelpers';
import { swaggerSpec } from '@/lib/swagger';

describe('/api/swagger.json', () => {
  test('должен возвращать swaggerSpec в формате успешного ответа', async () => {
    const res = await GET();
    const data = await expectSuccessResponse(res);

    expect(data.data).toBeDefined();
    expect(data.data).toMatchObject({
      openapi: swaggerSpec.openapi,
      info: expect.objectContaining({
        title: swaggerSpec.info?.title,
        version: swaggerSpec.info?.version,
      }),
    });
  });
});


