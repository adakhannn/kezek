'use strict';
// Adds latency to the same user-authorized anonymous GET boundary; never broadens it.
require('./closure-s1-public-read-guard.cjs');
const { permits } = require('./closure-s1-public-read-policy.cjs');
const guardedFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const permitted = permits(input, init, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (permitted?.table === 'businesses') {
    console.log(JSON.stringify({ event: 's23-public-read-pending', delayMs: 10000, utc: new Date().toISOString() }));
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  return guardedFetch(input, init);
};
