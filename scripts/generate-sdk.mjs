import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { repoRoot } from './docs-lib.mjs';
import { buildOpenApi, checkOpenApi } from './generate-openapi.mjs';

const require = createRequire(import.meta.url);
const { generate } = require('openapi-typescript-codegen');
export const sdkDirectory = path.join(repoRoot, 'packages/shared-client/src/generated-sdk/client');

export async function generateSdk(output = sdkDirectory) {
    // Stale reviewed inputs fail before files are written. Input is an object with
    // internal refs only: the generator never fetches a spec from a running server.
    checkOpenApi();
    await generate({ input: buildOpenApi()['openapi-sdk.json'], output, httpClient: 'fetch', useOptions: true, useUnionTypes: true, exportCore: true, exportServices: true, exportModels: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.length !== 2) throw new Error('This command uses the fixed reviewed source and SDK output directory.');
    await generateSdk();
    console.log('Generated reviewed SDK subset offline.');
}
