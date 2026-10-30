// One recoverable lease on an exact self-generated isolated artifact; no content edits or network.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base=path.resolve('C:/projects/kezek/test-results/closure-s1-20261020-f003-fontread-v2/build/apps/web/.next/static/chunks');
const target=path.resolve(base,'a3ede8c22273d7ed.js');
const backup=path.resolve(base,'a3ede8c22273d7ed.js.c06-backup');
const expected='2fd1f6ce351100e8508c3f6e480b85fbedf315f7f0de8446f0aaec17ce62ff2e';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(Date.now()>=Date.parse('2026-10-20T12:15:00Z')||path.dirname(target)!==base||path.dirname(backup)!==base||fs.existsSync(backup)||sha(target)!==expected)throw Error('Lease preflight rejected');
function restore(){
  if(fs.existsSync(backup)&&!fs.existsSync(target))fs.renameSync(backup,target);
  if(!fs.existsSync(target)||fs.existsSync(backup)||sha(target)!==expected)throw Error('RESTORE CONFLICT; do not overwrite');
  console.log(JSON.stringify({event:'c06-restored',utc:new Date().toISOString(),sha256:sha(target)}));
}
fs.renameSync(target,backup);
console.log(JSON.stringify({event:'c06-lease-applied',utc:new Date().toISOString(),target,backup,restoreAfterSeconds:90,sha256:expected}));
setTimeout(restore,90000);
process.on('SIGINT',()=>{restore();process.exit(0);});
