import { GET } from '@/app/api/swagger.json/route';
import { swaggerSpec } from '@/lib/swagger';
import { isOpenApiDocument } from '@/lib/openApiDocument';

test('serves the offline OpenAPI object at the JSON root, without a success envelope', async () => {
    const response = await GET();
    const document = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(document).toEqual(swaggerSpec);
    expect(document).not.toHaveProperty('ok');
    expect(document).not.toHaveProperty('data');
    expect(isOpenApiDocument(document)).toBe(true);
    expect(document.paths['/api/quick-hold'].post['x-contract-status']).toBe('reviewed');
    expect(document.paths['/api/users/search'].post['x-contract-status']).toBe('inventory-only');
});
