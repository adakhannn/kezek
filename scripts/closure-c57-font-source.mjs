// Public official font asset acquisition and metadata-only parity check, not browser automation.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mod = require('../apps/web/node_modules/next/dist/compiled/@next/font/dist/fontkit').default;
const fontFromBuffer = mod.default || mod;
const dest = 'C:/projects/kezek/test-results/closure-c57-font-source';
if (fs.existsSync(dest)) throw Error('Do not overwrite acquisition');
fs.mkdirSync(dest, { recursive:true });
const inputs = [
 ['Geist.ttf','https://raw.githubusercontent.com/google/fonts/main/ofl/geist/Geist%5Bwght%5D.ttf','f63f0afc6390323715972b6645115485f37cc9f4'],
 ['GeistMono.ttf','https://raw.githubusercontent.com/google/fonts/main/ofl/geistmono/GeistMono%5Bwght%5D.ttf','173867dce0580ea751e4b9c558740d34f20ce549'],
 ['OFL.txt','https://raw.githubusercontent.com/google/fonts/main/ofl/geist/OFL.txt','61f6f4b7853081236aec6407f2dd3c7170997f84'],
 ['C54-Geist-latin.woff2','https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFWNOITd.woff2'],
 ['C54-GeistMono-latin.woff2','https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2'],
];
const results=[];
for (const [file,url,blobSha] of inputs) {
 const startedUtc=new Date().toISOString();
 try {
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  const gitBlobSha=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  if(blobSha&&gitBlobSha!==blobSha)throw Error('Official blob content mismatch');
  fs.writeFileSync(path.join(dest,file),bytes,{flag:'wx'});
  const result={file,url,startedUtc,finishedUtc:new Date().toISOString(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),gitBlobSha};
  if(!file.endsWith('.txt')){
   const font=fontFromBuffer(bytes);
   Object.assign(result,{family:font.familyName,subfamily:font.subfamilyName,version:font.version,axes:font.variationAxes,unitsPerEm:font.unitsPerEm,ascent:font.ascent,descent:font.descent,lineGap:font.lineGap,
    missingRuKy:[...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяӨөҮүҢң'].filter(c=>!font.hasGlyphForCodePoint(c.codePointAt(0))),
    latinAdvances:[...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'].map(c=>font.glyphForCodePoint(c.codePointAt(0)).advanceWidth)});
  }
  results.push(result);
 }catch(e){results.push({file,url,startedUtc,finishedUtc:new Date().toISOString(),error:String(e),cause:String(e.cause??'')});}
}
fs.writeFileSync(path.join(dest,'result.json'),JSON.stringify({results},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({results},null,2));
