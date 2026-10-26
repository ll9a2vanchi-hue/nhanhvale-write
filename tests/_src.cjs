// Combined app source for static tests (v6.14 split index.html into css/ and js/ files): html + css + js in load order.
const fs=require('fs'),path=require('path');const R=path.join(__dirname,'..');
const FILES=['index.html','css/app.css','js/version.js','js/app.js','js/icons-fx.js','js/enhancements.js'];
module.exports=FILES.map(f=>fs.readFileSync(path.join(R,f),'utf8')).join('\n');module.exports.FILES=FILES;
