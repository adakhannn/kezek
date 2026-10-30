'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const realNow = Date.now;
Date.now = () => Date.parse('2026-10-18T12:30:00Z');
test.after(() => { Date.now = realNow; });
const { allowed } = require('./closure-s1-font-read-guard.cjs');
const css='https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap';
test('compiler public Geist CSS GET permitted without actual network',()=>assert.equal(allowed(css),true));
test('compiler public Geist binary GET permitted without actual network',()=>assert.equal(allowed('https://fonts.gstatic.com/s/geist/v5/font.woff2'),true));
for(const [label,input,options] of [
  ['write',css,{method:'POST'}],['head',css,{method:'HEAD'}],['body',css,{body:'data'}],
  ['cookie',css,{headers:{cookie:'fixture'}}],['authorization',css,{headers:{authorization:'fixture'}}],['key',css,{headers:{apikey:'fixture'}}],
  ['other host','https://example.com/css2?family=Geist',{}],['http','http://fonts.googleapis.com/css2?family=Geist',{}],
  ['port','https://fonts.googleapis.com:444/css2?family=Geist',{}],['credential','https://user:fixture@fonts.googleapis.com/css2?family=Geist',{}],
  ['other font','https://fonts.googleapis.com/css2?family=Other',{}],['other path','https://fonts.gstatic.com/private',{}],['DEV database','https://beulnmftzbmtbdlgurht.supabase.co/rest/v1/businesses',{}],
]) test('deny '+label,()=>assert.equal(allowed(input,options),false));
test('permission expires even for approved font GET',()=>{
  Date.now = () => Date.parse('2026-10-18T12:34:00Z');
  assert.equal(allowed(css),false);
  Date.now = () => Date.parse('2026-10-18T12:30:00Z');
});
