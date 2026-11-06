// v6.15.2 regression: balanced editor markup and correct scroll on new article.
const fs=require('node:fs'),assert=require('node:assert/strict');
const src=fs.readFileSync('js/app.js','utf8');
const from=src.indexOf('<div class="write-customization" id="writeCustomization">');
const to=src.indexOf('<div class="write-document" style',from);
assert(from>=0&&to>from,'editor markup anchors exist');
const markup=src.slice(from,to);
const count=(word)=>markup.split(word).length-1;
assert.equal(count('<div'),count('</div>'),'the customization markup has balanced div tags');
assert(markup.indexOf('id="backgroundPanel"')>markup.indexOf('id="nvToolColors"'),'background picker follows colours');
assert(markup.includes('id="nvToolMore"'),'secondary toolbar exists');
assert(src.includes('const enteringTopic=!!current&&current.id!==nvLastRenderedTopicId'),'only reset scroll on new article');
assert(src.includes('if(enteringTopic){document.body.scrollTop=0;document.documentElement.scrollTop=0;window.scrollTo(0,0);'),'reset both body and viewport');
console.log('PASS: balanced editor structure and reset scroll on opening a topic');
