import test from 'node:test';
import assert from 'node:assert/strict';
import {distribute,reduce,emptyState,addDays,monday,dayDiff} from '../src/model.js';
test('study allocation conserves the total, uses chosen weekdays and excludes exam days',()=>{
 const exam={id:'exam',name:'중간고사',start:'2026-10-19',end:'2026-10-23'};
 const {tasks}=distribute({name:'수학',total:121,unit:'문제',weekdays:[1,3,5],start:'2026-09-30',color:'lavender'},exam);
 assert.equal(tasks.reduce((sum,t)=>sum+t.amount,0),121);
 assert.ok(tasks.every(t=>t.date<exam.start&&[1,3,5].includes(new Date(t.date+'T12:00:00').getDay())));
 assert.ok(Math.max(...tasks.map(t=>t.amount))-Math.min(...tasks.map(t=>t.amount))<=1);
 assert.throws(()=>distribute({name:'수학',total:100,weekdays:[],start:'2026-09-30'},exam));
 assert.throws(()=>distribute({name:'수학',total:1.5,weekdays:[1],start:'2026-09-30'},exam));
 assert.throws(()=>distribute({name:'수학',total:1,weekdays:[1],start:exam.start},exam));
});
test('inbox scheduling, edits and completion share a single task and survive serialization',()=>{
 let s=emptyState();s=reduce(s,{type:'task-save',task:{id:'one',title:'오답 노트',date:'',amount:4,unit:'쪽',done:false}});
 s=reduce(s,{type:'task-date',id:'one',date:'2026-10-01'});
 s=reduce(s,{type:'task-save',task:{id:'one',title:'수학 오답 노트',amount:8}});
 s=reduce(s,{type:'task-toggle',id:'one'});
 const loaded=JSON.parse(JSON.stringify(s));assert.equal(loaded.tasks.length,1);assert.equal(loaded.tasks[0].date,'2026-10-01');assert.equal(loaded.tasks[0].amount,8);assert.equal(loaded.tasks[0].done,true);
});
test('exam deletion only removes linked studies; small totals produce no zero tasks',()=>{
 const exam={id:'e',name:'기말고사',start:'2026-10-20',end:'2026-10-24'};
 let s=reduce(emptyState(),{type:'exam-add',exam,subjects:[{name:'영어',total:2,unit:'강',weekdays:[1,2,3,4,5],start:'2026-09-30',color:'blue'}]});
 assert.equal(s.tasks.length,2);assert.ok(s.tasks.every(t=>t.amount===1));
 s=reduce(s,{type:'task-save',task:{id:'personal',title:'개인 할 일',date:''}});
 s=reduce(s,{type:'exam-delete',id:'e'});assert.equal(s.tasks.length,1);assert.equal(s.subjects.length,0);assert.equal(s.exams.length,0);
 assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(monday('2026-10-04'),'2026-09-28');assert.equal(dayDiff('2026-10-01','2026-09-30'),1);
});
