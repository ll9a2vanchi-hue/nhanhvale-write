// Static server that applies vercel.json headers (CSP etc.): node tests/serve-with-headers.cjs . 8010
const http=require('http'),fs=require('fs'),path=require('path');const root=process.argv[2],port=+process.argv[3]||8010;
const cfg=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((q,r)=>{let p=decodeURIComponent(new URL(q.url,'http://x').pathname);if(p==='/')p='/index.html';const f=path.join(root,p);
 for(const h of cfg.headers){const re=new RegExp('^'+h.source.replace('(.*)','.*')+'$');if(re.test(new URL(q.url,'http://x').pathname))for(const x of h.headers)r.setHeader(x.key,x.value)}
 fs.readFile(f,(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');r.end(d)})}).listen(port,()=>console.log('up',port));
