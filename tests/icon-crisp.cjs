// Versioned, high-contrast icons for Android PWA and iOS.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p));
for(const [f,size] of [['icon-crisp-192.png',192],['icon-crisp-512.png',512],['icon-crisp-maskable-512.png',512],['apple-touch-crisp.png',180]]){
 const buf=read(f);
 assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a',f+' PNG signature');
 assert.equal(buf.readUInt32BE(16),size,f+' width');
 assert.equal(buf.readUInt32BE(20),size,f+' height');
 assert.equal(buf[25],6,f+' RGBA');
}
const manifest=JSON.parse(read('manifest.webmanifest').toString('utf8'));
const paths=manifest.icons.map(x=>x.src.replace(/^\//,''));
for(const f of ['icon-crisp-192.png','icon-crisp-512.png','icon-crisp-maskable-512.png','icon-crisp.svg'])assert(paths.includes(f),f+' manifest');
assert(manifest.icons.some(x=>x.src.includes('maskable')&&x.purpose==='maskable'),'Android maskable source');
const index=read('index.html').toString('utf8'),sw=read('sw.js').toString('utf8'),svg=read('icon-crisp.svg').toString('utf8');
for(const f of ['icon-crisp-192.png','icon-crisp.svg','apple-touch-crisp.png'])assert(index.includes(f),'index '+f);
for(const f of [...paths,'apple-touch-crisp.png'])assert(sw.includes('/'+f),'service worker precache '+f);
assert(svg.includes('#19314f')&&svg.includes('#f5faff'),'high contrast icon palette');
console.log('PASS: crisp PNG icon sizes and RGB, Android maskable, SVG, iOS, manifest and offline cache');
