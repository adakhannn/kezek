'use strict';
const fs = require('node:fs');
const net = require('node:net');
const { AsyncLocalStorage } = require('node:async_hooks');
const { permits, host } = require('./closure-s1-public-read-policy.cjs');
const flag = 'C:/projects/kezek/docs/verification/runs/2026-10-18-s1/s18-network-open.json';
const context = new AsyncLocalStorage();
const originalConnect = net.Socket.prototype.connect;
const originalFetch = globalThis.fetch;
const deny = () => Object.assign(new Error('S18 controlled public-read network boundary'), { code: 'S18_PUBLIC_READ_BLOCKED' });
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (context.getStore() === true && first && typeof first === 'object' && first.host === host && Number(first.port) === 443) return originalConnect.apply(this, args);
  throw deny();
};
let requests = 0;
globalThis.fetch = async (input, init) => {
  const permitted = permits(input, init, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!permitted || !fs.existsSync(flag) || Date.now() >= Date.parse('2026-10-18T12:25:00Z') || requests >= 80) throw deny();
  requests += 1;
  const signal = init?.signal || input?.signal;
  const response = await context.run(true, () => originalFetch(input, { ...init, redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) }));
  console.log(JSON.stringify({ event: 's18-public-get', table: permitted.table, status: response.status, sequence: requests, utc: new Date().toISOString() }));
  return response;
};
