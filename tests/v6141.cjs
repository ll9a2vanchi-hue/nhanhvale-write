// v6.14.1 static checks (no dependencies): node tests/v6141.cjs
const fs=require('fs'),path=require('path'),assert=require('assert');const R=path.join(__dirname,'..');const rd=f=>fs.readFileSync(path.join(R,f),'utf8');
const css=rd('css/app.css'),app=rd('js/app.js'),enh=rd('js/enhancements.js');
assert(/NV_VERSION='6\.14\.1'/.test(rd('js/version.js')),'version 6.14.1');assert(/nv-write-v43/.test(rd('sw.js')),'SW cache v43');
// Clear-format: accessible name = visible text, icon only shown below 400px
assert(/class="format-button nv-clear-format" data-cmd="removeFormat" aria-label="Xóa định dạng" title="Xóa định dạng"/.test(app),'clear-format aria-label+title');
assert(/<span class="nv-clear-format-text">Xóa định dạng<\/span>/.test(app),'clear-format visually-hidden text');
assert(/@media\s*\(max-width:\s*399\.98px\)[^}]*\.nv-clear-format/.test(css),'compact clear-format under 400px');
// Dark surfaces for related cards, settings buttons, conflict dialog, badges
for(const s of ['.related-open','.related-unlink','.settings-back','.icon-action','.nv-conflict-dialog','.nv-conflict-actions button','.two .badge'])assert(css.includes('html[data-theme=dark] '+s),'dark rule for '+s);
// Goal toast placement avoids the dock and follows visualViewport
assert(/function placeWT/.test(enh)&&/#writeCustomization:not\(\[hidden\]\)/.test(enh)&&/visualViewport/.test(enh)&&/rePlaceWT/.test(enh),'toast placed clear of dock');
console.log('PASS: v6.14.1 version/SW v43, clear-format icon + accessible name, dark surfaces, toast-vs-dock placement');
