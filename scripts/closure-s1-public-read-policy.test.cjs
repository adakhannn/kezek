const test = require('node:test');
const assert = require('node:assert/strict');
const { permits } = require('./closure-s1-public-read-policy.cjs');
const origin = 'https://beulnmftzbmtbdlgurht.supabase.co';
const anon = 'non-real-test-anon';
const headers = { apikey: anon, authorization: `Bearer ${anon}` };
const base = '/rest/v1/businesses?select=id,name,slug,categories&is_approved=eq.true&limit=500';
test('only approved public business GET succeeds', () => assert.equal(permits(origin + base, { headers }, anon)?.table, 'businesses'));
for (const method of ['POST', 'PATCH', 'DELETE', 'PUT', 'HEAD']) test(`deny ${method}`, () => assert.equal(permits(origin + base, { headers, method }, anon), null));
for (const [label, url, init] of [
  ['other host', 'https://example.com' + base, { headers }],
  ['http', origin.replace('https:', 'http:') + base, { headers }],
  ['other port', origin + ':8443' + base, { headers }],
  ['auth endpoint', origin + '/auth/v1/user', { headers }],
  ['RPC', origin + '/rest/v1/rpc/create_internal_booking', { headers }],
  ['private table', origin + '/rest/v1/profiles?select=id', { headers }],
  ['wildcard select', origin + base.replace('id,name,slug,categories', '*'), { headers }],
  ['unapproved', origin + base.replace('eq.true', 'eq.false'), { headers }],
  ['unknown query', origin + base + '&or=(is_approved.eq.false)', { headers }],
  ['user bearer', origin + base, { headers: { ...headers, authorization: 'Bearer non-real-user' } }],
  ['service role', origin + base, { headers: { apikey: 'non-real-service', authorization: 'Bearer non-real-service' } }],
  ['cookie', origin + base, { headers: { ...headers, cookie: 'non-real-cookie' } }],
  ['body', origin + base, { headers, body: 'non-real-body' }],
]) test(`deny ${label}`, () => assert.equal(permits(url, init, anon), null));
test('branch map GET requires active filter and UUID scope', () => {
  const url = origin + '/rest/v1/branches?select=id,name,address,biz_id,lat,lon&biz_id=in.(c28c8109-bedc-4f9e-bbc2-30f4b549131e)&is_active=eq.true&lat=not.is.null&lon=not.is.null&limit=500';
  assert.equal(permits(url, { headers }, anon)?.table, 'branches');
  assert.equal(permits(url.replace('&is_active=eq.true', ''), { headers }, anon), null);
});
test('public category metadata only', () => {
  const url = origin + '/rest/v1/categories?select=slug,name_ru&slug=in.(barbershop,zhenskaya-parikmaherskaya)';
  assert.equal(permits(url, { headers }, anon)?.table, 'categories');
});
