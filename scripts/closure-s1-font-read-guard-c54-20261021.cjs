'use strict';
// User-approved21Oct current work untilstop: public Google Fonts GET only. Finite attempt lease; no auth/cookies/body/DB. Node restriction, NOT OS firewall.
const { AsyncLocalStorage } = require('node:async_hooks');
const net = require('node:net');
const https = require('node:https');
const path = require('node:path');
const context = new AsyncLocalStorage();
const hosts = new Set(['fonts.googleapis.com','fonts.gstatic.com']);
const fs = require('node:fs');
const permissionFile = 'C:/projects/kezek/docs/verification/runs/2026-10-20-s1-continuation/c54-font-permission.json';
function authorized() { try { const p=JSON.parse(fs.readFileSync(permissionFile)); return p.status==='ACTIVE' && Date.now()<Date.parse(p.compilerLeaseExpiresUtc); } catch { return false; } }
const connect = net.Socket.prototype.connect;
const request = https.request;
const fetch = globalThis.fetch;
const deny = () => Object.assign(new Error('C54 compiler permits public font GET only'),{code:'C54_FONT_READ_DENIED'});
function allowed(input, options={}) {
  let url; try { url = new URL(input); } catch { return false; }
  const headers = new Headers(options.headers || {});
  const fontPath = url.hostname==='fonts.googleapis.com' ? url.pathname==='/css2' && url.searchParams.get('family')?.startsWith('Geist') : /^\/s\/geist(?:mono)?\/.*\.woff2$/.test(url.pathname) && !url.search;
  return authorized() && url.protocol==='https:' && hosts.has(url.hostname) && fontPath && (!url.port||url.port==='443') && !url.username && !url.password && (options.method||'GET').toUpperCase()==='GET' && !options.body && !headers.has('cookie') && !headers.has('authorization') && !headers.has('apikey');
}
module.exports = { allowed };
net.Socket.prototype.connect = function(...args) {
  const first=Array.isArray(args[0])?args[0][0]:args[0];
  const port=Number(process.argv[2]);
  const worker=path.resolve('C:/projects/kezek/test-results/closure-s1-20261021-c54-fontread/build/apps/web/.next/build/postcss.js').toLowerCase();
  if(first&&typeof first==='object'&&process.argv[1]&&path.resolve(process.argv[1]).toLowerCase()===worker&&first.host==='127.0.0.1'&&Number(first.port)===port&&port>=1024&&port<=65535&&port!==3000)return connect.apply(this,args);
  if(authorized()&&context.getStore()===true&&first&&typeof first==='object'&&hosts.has(first.host)&&Number(first.port)===443)return connect.apply(this,args);
  throw deny();
};
https.request = function(input,options,callback) {
  if(typeof options==='function'){callback=options;options={};}
  if(!allowed(input,options))throw deny();
  const req=context.run(true,()=>request.call(this,input,{...options,agent:false},callback));
  req.write=()=>{throw deny();};
  const end=req.end;
  req.end=function(chunk,...rest){if(chunk&&typeof chunk!=='function')throw deny();return end.call(this,chunk,...rest);};
  req.on('response',res=>console.log(JSON.stringify({event:'c54-font-get',host:new URL(input).hostname,status:res.statusCode,utc:new Date().toISOString()})));
  return req;
};
globalThis.fetch = async(input,options={})=>{
  if(!allowed(input,options))throw deny();
  return context.run(true,()=>fetch(input,{...options,redirect:'error',signal:AbortSignal.timeout(15000)}));
};
