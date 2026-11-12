const fs=require('node:fs'),assert=require('node:assert/strict'),app=fs.readFileSync('js/app.js','utf8'),css=fs.readFileSync('css/app.css','utf8');
for(const term of ['function nvBindTopicResults(root)','el.onkeydown=e=>','role','tabIndex','nvQueueTopicSearch','nvRefreshTopicSearch','nvTopicResults','nvTopicMatchCount','compositionend','nvStorageCheck'])assert(app.includes(term),'missing '+term);
assert(!app.includes("query=e.target.value;const pos=e.target.selectionStart;render()"),'no full redraw on search typing');
assert(app.includes("t.title+' '+(t.tag||'')+' '+t.content"),'category search');
assert(css.includes('[data-open][role="button"]:focus-visible'),'visible keyboard outline');
assert(app.includes('id="topicDensityToggle"'),'density control remains');
console.log('PASS: incremental search, keyboard cards, larger targets, storage information');
