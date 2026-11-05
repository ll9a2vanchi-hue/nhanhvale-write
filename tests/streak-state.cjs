// Regression: an unfinished current day must not erase yesterday's completed streak.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('js/app.js','utf8');
const a=src.indexOf('function shieldStats(){'), b=src.indexOf('const done=()',a);
assert(a>=0&&b>a,'streak function available');
const source=src.slice(a,b);
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[2026,10,3,12,0,0]))}}
const dateKey=(daysAgo)=>{const d=new FixedDate();d.setDate(d.getDate()-daysAgo);return d.toLocaleDateString('en-CA')};
const today=dateKey(0),yesterday=dateKey(1),dayBefore=dateKey(2),threeDays=dateKey(3);
function check(logs,expected,desc){const context={db:{logs,settings:{minWords:50}},Date:FixedDate};vm.createContext(context);vm.runInContext(source+';this.getStreak=streak',context);assert.equal(context.getStreak(),expected,desc)}
check({},0,'no activity');
check({[today]:10},0,'today in progress without previous streak');
check({[yesterday]:55},1,'yesterday met, today not started');
check({[today]:10,[yesterday]:55},1,'today partial cannot reset streak');
check({[today]:10,[yesterday]:55,[dayBefore]:57},2,'today partial keeps prior two-day streak');
check({[today]:50,[yesterday]:55},2,'today complete extends streak');
check({[today]:50,[yesterday]:0,[dayBefore]:59},1,'gap yesterday ends old chain');
check({[today]:10,[yesterday]:10,[dayBefore]:59},0,'yesterday incomplete means no streak');
check({[yesterday]:58,[dayBefore]:58,[threeDays]:0},2,'chain stops at first missed day');
assert(src.includes("'Bắt đầu chuỗi'"),'zero days replaced by a start prompt');
assert(src.includes("Math.min(todayWords,db.settings.minWords)"),'daily writing progress shown');
console.log('PASS: streak continuity, incomplete days, reset after gap, and empty state');
