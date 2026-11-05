// Deterministic reward/consumption regression tests. Run: node tests/shields.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('js/app.js','utf8');
const begin=src.indexOf('function shieldStats(){'),end=src.indexOf('const done=()',begin);
assert(begin>=0&&end>begin,'shield and streak functions are present');
const pure=src.slice(begin,end);
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[2026,10,5,12,0,0]))}}
const key=(daysAgo)=>{const d=new FixedDate();d.setDate(d.getDate()-daysAgo);return d.toLocaleDateString('en-CA')};
const days=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
function check(qualified,partial,expected,label){
 const logs={};for(const offset of qualified)logs[key(offset)]=50;
 for(const [offset,words] of Object.entries(partial||{}))logs[key(Number(offset))]=words;
 const context={db:{logs,settings:{minWords:50}},Date:FixedDate,today:()=>key(0)};
 vm.createContext(context);vm.runInContext(pure+';this.state=shieldStats;this.getStreak=streak',context);
 const state=context.state();
 assert.deepEqual([state.streak,state.shields,state.progress],expected,label);
 assert.equal(context.getStreak(),state.streak,label+' streak matches');
 assert.deepEqual([context.state().streak,context.state().shields,context.state().progress],expected,label+' reload does not double-spend');
 return state;
}
check([],{},[0,0,0],'no writing');
check(days(1,6),{},[6,0,6],'six consecutive days are not a shield');
check(days(1,7),{},[7,1,0],'seven complete days earn one shield');
check(days(1,14),{},[14,2,0],'fourteen days earn two shields');
check(days(1,21),{},[21,2,0],'more writing never exceeds cap');
assert.equal(check(days(2,8),{},[7,0,0],'miss one day consumes a shield').protectedDays,1);
assert.equal(check(days(3,16),{},[14,0,0],'two missed days spend two shields').protectedDays,2);
check(days(4,17),{},[0,0,0],'third missed day breaks the streak');
check([...days(0,6),...days(8,14)],{},[14,1,0],'shielded day preserves streak but resets reward progress');
check([...days(2,7),0],{},[1,0,1],'unprotected missed day resets streak');
check(days(1,7),{0:10},[7,1,0],'unfinished current day must not spend a shield');
console.log('PASS: every 7 days +1 shield, capped at 2, missed-day protection, sync determinism');
