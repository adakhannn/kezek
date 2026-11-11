import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { apiRouteRecords, apiContractCoverage } from './generate-api-catalog.mjs';
import { repoRoot } from './docs-lib.mjs';
import { reviewedOperations, reviewedSources, schemas } from './openapi-contracts.mjs';

export const artifactDirectory = path.join(repoRoot, 'apps/web/src/generated');
export const encode = value => JSON.stringify(value, null, 2) + '\n';

export function openApiPath(route) {
    // There are no catch-all handlers today. Fail explicitly if one is introduced:
    // optional/catch-all Next routes cannot be represented by a naive {parameter}.
    if (route.includes('[...') || route.includes('[[')) throw new Error(`Review catch-all OpenAPI mapping: ${route}`);
    return route.replace(/\[([^\]]+)\]/g, '{$1}');
}

export function buildOpenApi() {
    const records = apiRouteRecords();
    const coverage = apiContractCoverage(records);
    if (coverage.failures.length) throw new Error(coverage.failures.join('\n'));
    const inventory = records.flatMap(record => record.methods.map(method => ({
        method, route: record.route, file: record.file, guide: coverage.contracts.get(`${method} ${record.route}`),
    }))).sort((a, b) => `${a.route} ${a.method}`.localeCompare(`${b.route} ${b.method}`, 'en'));
    const known = new Set(inventory.map(item => `${item.method} ${item.route}`));
    for (const key of Object.keys(reviewedOperations)) if (!known.has(key)) throw new Error(`Reviewed operation has no route export: ${key}`);
    const sources = [...new Set([...reviewedSources, ...inventory.filter(item => reviewedOperations[`${item.method} ${item.route}`]).map(item => item.file)])].sort();
    const hash = createHash('sha256');
    for (const source of sources) hash.update(source).update('\0').update(fs.readFileSync(path.join(repoRoot, source), 'utf8').replace(/\r\n/g, '\n')).update('\0');
    const base = {
        openapi: '3.0.3',
        info: { title: 'Kezek HTTP API', version: '0.1.0', description: 'Source inventory of explicit Next route exports. Only operations marked reviewed have typed wire contracts. Inventory-only operations do not specify authentication, input or response schemas. This is not a deployment or full compatibility guarantee. See SWAGGER_SETUP.md and API_DOCUMENTATION.md in the repository.' },
        servers: [{ url: '/', description: 'Same origin. SDK consumers must configure their own approved base URL.' }],
        'x-reviewed-source-sha256': hash.digest('hex'),
        'x-reviewed-sources': sources,
        'x-inventory-boundary': 'Explicit route exports including .tsx and local re-exports; no implicit framework HEAD/OPTIONS, middleware, rewrites, direct Supabase or deployment validation.',
        components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', description: 'Verified Supabase access token. Some browser flows additionally support the existing session cookies, as described per operation.' } }, schemas },
    };
    const paths = {};
    const sdkPaths = {};
    for (const item of inventory) {
        const routePath = openApiPath(item.route);
        const method = item.method.toLowerCase();
        if (paths[routePath]?.[method]) throw new Error(`Duplicate OpenAPI operation: ${item.method} ${routePath}`);
        const reviewed = reviewedOperations[`${item.method} ${item.route}`];
        const operation = {
            ...(reviewed ?? {
                tags: ['Inventory only'],
                summary: 'Inventory only — see the source-reviewed manual contract',
                description: `Authentication, inputs, errors and side effects are described in ${item.guide}. No typed contract is declared here; absence of a security declaration does not imply public access.`,
                'x-contract-status': 'inventory-only',
                parameters: [...routePath.matchAll(/\{([^}]+)\}/g)].map(match => ({ name: match[1], in: 'path', required: true, schema: { type: 'string' }, description: 'Route segment only; semantic validation is not modeled.' })),
                responses: { default: { description: 'Unmodeled response. Consult the linked manual contract and source.' } },
            }),
            'x-next-route': item.route, 'x-source-file': item.file, 'x-manual-contract': item.guide,
        };
        (paths[routePath] ??= {})[method] = operation;
        if (reviewed) (sdkPaths[routePath] ??= {})[method] = operation;
    }
    return {
        'openapi.json': { ...base, 'x-explicit-operation-count': inventory.length, 'x-reviewed-operation-count': Object.keys(reviewedOperations).length, paths },
        'openapi-sdk.json': { ...base, info: { ...base.info, title: 'Kezek reviewed SDK subset', description: 'Only the source-reviewed booking and shift commands. This document deliberately excludes every inventory-only operation. Client generation supplies types and transport, not runtime validation, token refresh, idempotency-key creation or automatic retries.' }, paths: sdkPaths },
    };
}

export function writeOpenApi(directory = artifactDirectory) {
    const artifacts = buildOpenApi();
    fs.mkdirSync(directory, { recursive: true });
    for (const [name, value] of Object.entries(artifacts)) fs.writeFileSync(path.join(directory, name), encode(value));
    return artifacts;
}

export function checkOpenApi(directory = artifactDirectory) {
    for (const [name, value] of Object.entries(buildOpenApi())) {
        const file = path.join(directory, name);
        if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== encode(value)) throw new Error(`${name} is stale. Review changed contracts, then run pnpm generate:openapi.`);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !['--write', '--check'].includes(args[0])) throw new Error('Use --write or --check.');
    if (args[0] === '--write') writeOpenApi(); else checkOpenApi();
    console.log(`OpenAPI ${args[0] === '--write' ? 'generated' : 'verified'} offline from route AST and reviewed contracts.`);
}
