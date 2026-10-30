'use strict';
// Test-process boundary only. No application authorization or production policy changes.
const host = 'beulnmftzbmtbdlgurht.supabase.co';
const selections = {
  businesses: ['id,name,slug,categories', 'id,slug,name,address,phones,contact_phone,categories,rating_score', 'id,slug,name,address,phones,contact_phone,contact_whatsapp,contact_email,website_url,rating_score,tz'],
  branches: ['id,biz_id', 'id,name,address,biz_id,lat,lon', 'id,name,address,rating_score,directory_links,contact_phone,contact_whatsapp,contact_email,website_url,inherit_business_contacts'],
  services: ['id,name_ru,name_ky,name_en,duration_min,price_from,price_to,branch_id'],
  staff: ['id,full_name,branch_id,avatar_url,rating_score'],
  branch_promotions: ['branch_id', 'id,branch_id,promotion_type,title_ru,params,branches(name)'],
  categories: ['slug,name_ru'],
};
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ids = new RegExp(`^(?:eq\\.${uuid}|in\\.\\(${uuid}(?:,${uuid})*\\))$`);
function permits(input, init, anon) {
  try {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    const headers = new Headers(init?.headers || input?.headers);
    const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
    if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password || url.hash || method !== 'GET' || init?.body || input?.body || !anon) return null;
    if (headers.has('cookie') || headers.get('apikey') !== anon || headers.get('authorization') !== `Bearer ${anon}`) return null;
    if (!selections[table]?.includes((url.searchParams.get('select') || '').replace(/\s/g, ''))) return null;
    const allowed = new Set(['select', 'order', 'limit', 'offset', 'is_approved', 'slug', 'biz_id', 'is_active', 'active', 'branch_id', 'lat', 'lon']);
    if ([...url.searchParams.keys()].some(k => !allowed.has(k))) return null;
    if (table === 'businesses') {
      if (url.searchParams.get('is_approved') !== 'eq.true') return null;
      const slug = url.searchParams.get('slug');
      if (slug && !['eq.testovyy-biznes-1', 'eq.testovyy-biznes-2'].includes(slug)) return null;
    } else if (table === 'categories') {
      if (!/^in\.\([a-z0-9_,"-]+\)$/.test(url.searchParams.get('slug') || '')) return null;
    } else if (table === 'branch_promotions') {
      const branch = url.searchParams.get('branch_id') || '';
      if (!ids.test(branch) || url.searchParams.get('is_active') !== 'eq.true') return null;
    } else {
      if (!ids.test(url.searchParams.get('biz_id') || '')) return null;
      if (url.searchParams.get(table === 'services' ? 'active' : 'is_active') !== 'eq.true') return null;
      if (['lat', 'lon'].some(k => url.searchParams.has(k) && url.searchParams.get(k) !== 'not.is.null')) return null;
    }
    return { url, table };
  } catch { return null; }
}
module.exports = { permits, host };
