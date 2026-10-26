// v6.14.0 static checks for the source split (no dependencies): node tests/v614.cjs
const fs=require('fs'),path=require('path'),assert=require('assert');const R=path.join(__dirname,'..');const rd=f=>fs.readFileSync(path.join(R,f),'utf8');
const html=rd('index.html'),sw=rd('sw.js'),csp=JSON.parse(rd('vercel.json')).headers.flatMap(h=>h.headers).find(h=>h.key==='Content-Security-Policy').value;
// 1. No inline code left in index.html: every <script> has src, no <style> blocks, no inline handlers / javascript: URLs.
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html),'no inline <script>');assert(!/<style[\s>]/i.test(html),'no inline <style>');
assert(!/\son[a-z]+\s*=/i.test(html)&&!/javascript:/i.test(html),'no inline handlers');
const files=[...html.matchAll(/<(?:script[^>]*\bsrc|link[^>]*\bhref)="([^"]+\.(?:js|css))"/g)].map(m=>'/'+m[1].replace(/^\//,''));
assert.deepEqual(files,['/js/version.js','/css/app.css','/js/app.js','/js/icons-fx.js','/js/enhancements.js'],'load order');
for(const f of files)assert(fs.existsSync(path.join(R,f)),f+' exists');
// 2. Service worker precaches every app file (network-first SW only falls back to precached URLs → offline reload).
for(const f of [...files,'/vendor/supabase-js-2.95.0.js'])assert(sw.includes("'"+f+"'"),'precache '+f);assert(/nv-write-v43/.test(sw));
// 3. CSP: scripts only from self (no 'unsafe-inline', no esm.sh); styles keep 'unsafe-inline' (style= attributes / CSSOM).
const dir=n=>(csp.split(';').map(s=>s.trim()).find(s=>s.startsWith(n+' '))||'');
assert.equal(dir('script-src'),"script-src 'self'");assert.equal(dir('style-src'),"style-src 'self' 'unsafe-inline'");assert(!csp.includes('esm.sh'));
// 4. supabase-js is vendored, self-contained, and the app imports it from /vendor.
const js=['js/version.js','js/app.js','js/icons-fx.js','js/enhancements.js'].map(rd).join('\n');assert(!js.includes('esm.sh'));assert(js.includes("import('/vendor/supabase-js-2.95.0.js')"));
const v=rd('vendor/supabase-js-2.95.0.js');assert(!/(^|[;}])\s*import\s*[{*"'\w]|[^.\w$]import\s*\(/.test(v),'vendor bundle has no imports');assert(/export\s*\{[^}]*createClient/.test(v));
// 5. Exactly one version constant, in its own file.
assert.deepEqual([...js.matchAll(/NV_VERSION\s*=\s*'([^']+)'/g)].map(m=>m[1]),['6.14.1']);
console.log('PASS: v6.14.0 split (no inline code, load order), SW v43 precache, strict script-src CSP, vendored supabase-js');
