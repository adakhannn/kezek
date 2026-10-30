// One recoverable lease on an exact self-generated isolated artifact; no content edits or network.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base=path.resolve('C:/projects/kezek/test-results/closure-s1-20261020-f004-fontread/build/apps/web/.next/static/chunks');
const target=path.resolve(base,'fec3fd9ad47d8cb1.js');
const backup=path.resolve(base,'fec3fd9ad47d8cb1.js.c07-backup');
const expected='aa2db7f139d09fb7f6ac2e5bc824a53f748c29bde17b1bf3cb5c458531957339';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(Date.now()>=Date.parse('2026-10-20T12:15:00Z')||path.dirname(target)!==base||path.dirname(backup)!==base||fs.existsSync(backup)||sha(target)!==expected)throw Error('Lease preflight rejected');
function restore(){
  if(fs.existsSync(backup)&&!fs.existsSync(target))fs.renameSync(backup,target);
  if(!fs.existsSync(target)||fs.existsSync(backup)||sha(target)!==expected)throw Error('RESTORE CONFLICT; do not overwrite');
  console.log(JSON.stringify({event:'c07-restored',utc:new Date().toISOString(),sha256:sha(target)}));
}
fs.renameSync(target,backup);
console.log(JSON.stringify({event:'c07-lease-applied',utc:new Date().toISOString(),target,backup,restoreAfterSeconds:90,sha256:expected}));
setTimeout(restore,90000);
process.on('SIGINT',()=>{restore();process.exit(0);});
