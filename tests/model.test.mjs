import test from 'node:test';
import assert from 'node:assert/strict';
import {distribute,reduce,emptyState,addDays,monday,dayDiff,compareSubjects,studyDays} from '../src/model.js';
const exam={id:'exam',name:'중간고사',start:'2026-10-19',end:'2026-10-23'};
const input={name:'미시경제학',rangeStart:3,rangeEnd:10,unit:'주차',splits:3,rounds:3,start:'2026-09-30',examDate:'2026-10-21',color:'lavender'};
test('every round covers the exact exam scope in order and ends before its own exam',()=>{
 const {subject,tasks}=distribute(input,exam);
 assert.equal(subject.rounds,3);assert.equal(tasks.length,9);
 assert.equal(tasks[0].date,input.start);assert.equal(tasks.at(-1).date,'2026-10-20');
 assert.ok(tasks.every((t,i)=>t.date<input.examDate&&(!i||t.date>=tasks[i-1].date)));
 for(let round=1;round<=3;round++){
  const part=tasks.filter(t=>t.round===round);
  assert.deepEqual(part.map(t=>[t.rangeStart,t.rangeEnd]),[[3,5],[6,8],[9,10]]);
  assert.equal(part.reduce((sum,t)=>sum+t.amount,0),8);
 }
 assert.equal(new Set(tasks.map(t=>t.id)).size,9);
});
test('short deadlines allow multiple sessions per day; a single session starts immediately',()=>{
 const {tasks}=distribute({...input,start:'2026-10-20'},exam);
 assert.equal(tasks.length,9);assert.ok(tasks.every(t=>t.date==='2026-10-20'));
 const single=distribute({...input,splits:1,rounds:1},exam).tasks;
 assert.equal(single.length,1);assert.equal(single[0].date,input.start);
 assert.deepEqual([single[0].rangeStart,single[0].rangeEnd],[3,10]);
});
test('invalid scopes, rounds, dates and splits are rejected without saving partial plans',()=>{
 for(const change of [{rangeStart:0},{rangeEnd:2},{rangeEnd:1001},{rangeStart:1.5},{splits:0},{splits:9},{rounds:0},{rounds:21},{rounds:1.5},{unit:'문제'},{start:input.examDate},{start:'2026-02-30'},{examDate:'2026-10-24'},{examDate:'2026-10-18'}])assert.throws(()=>distribute({...input,...change},exam));
 const state=emptyState();assert.throws(()=>reduce(state,{type:'exam-add',exam,subjects:[input,{...input,rounds:0}]}));assert.deepEqual(state,emptyState());
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
 let s=reduce(emptyState(),{type:'exam-add',exam,subjects:[{name:'회계원리',rangeStart:1,rangeEnd:2,unit:'챕터',splits:2,rounds:1,start:'2026-09-30',color:'blue'}]});
 assert.equal(s.tasks.length,2);assert.ok(s.tasks.every(t=>t.amount===1));
 s=reduce(s,{type:'task-save',task:{id:'personal',title:'개인 할 일',date:''}});
 s=reduce(s,{type:'exam-delete',id:'e'});assert.equal(s.tasks.length,1);assert.equal(s.subjects.length,0);assert.equal(s.exams.length,0);
 assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(monday('2026-10-04'),'2026-09-28');assert.equal(dayDiff('2026-10-01','2026-09-30'),1);
});

test('automatic splits adapt to available days and cover the whole scope every round',()=>{
 for(const start of ['2026-09-30','2026-10-18','2026-10-20']){
  const {subject,tasks}=distribute({...input,start,splits:null},exam);
  assert.equal(subject.autoSplit,true);assert.equal(subject.priority,'auto');
  assert.equal(subject.splits,Math.min(8,Math.max(1,Math.floor(dayDiff(input.examDate,start)/3))));
  for(let round=1;round<=3;round++){
   const ranges=tasks.filter(t=>t.round===round).flatMap(t=>Array.from({length:t.amount},(_,i)=>t.rangeStart+i));
   assert.deepEqual(ranges,[3,4,5,6,7,8,9,10]);
  }
  assert.ok(tasks.every(t=>t.date>=start&&t.date<input.examDate));
 }
});

test('automatic priority uses every remaining study day; manual importance overrides it',()=>{
 const today='2026-10-01',early={name:'빠른 시험',examDate:'2026-10-19',start:today},later={name:'늦은 시험',examDate:'2026-10-20',start:today};
 assert.ok(compareSubjects(early,later,today)<0);
 assert.ok(compareSubjects({...later,priority:'high'},early,today)<0);
 assert.ok(compareSubjects({...early,priority:'low'},later,today)>0);
 assert.ok(compareSubjects({...early,examDate:'2026-09-30',priority:'high'},later,today)>0);
 const short={...later,start:'2026-10-18'};assert.equal(studyDays(short,today),2);assert.ok(compareSubjects(short,early,today)<0);
 assert.ok(compareSubjects({...early,priority:'auto'},{...later,priority:'normal'},today)<0);
});

test('subject settings persist priority and safely reschedule only unfinished work',()=>{
 let state=reduce(emptyState(),{type:'exam-add',exam,subjects:[input]});
 const subject=state.subjects[0],first=state.tasks[0];
 state=reduce(state,{type:'task-toggle',id:first.id});
 const before=structuredClone(state.tasks);
 state=reduce(state,{type:'subject-update',id:subject.id,examDate:input.examDate,priority:'high'});
 assert.deepEqual(state.tasks,before);assert.equal(state.subjects[0].priority,'high');
 state=reduce(state,{type:'subject-update',id:subject.id,examDate:'2026-10-19',priority:'auto',start:'2026-10-15'});
 assert.deepEqual(state.tasks[0],before[0]);
 assert.ok(state.tasks.slice(1).every(t=>t.date>='2026-10-15'&&t.date<'2026-10-19'));
 assert.deepEqual(state.tasks.map(t=>[t.id,t.round,t.rangeStart,t.rangeEnd]),before.map(t=>[t.id,t.round,t.rangeStart,t.rangeEnd]));
 state=reduce(state,{type:'task-date',id:state.tasks[1].id,date:''});
 state=reduce(state,{type:'subject-update',id:subject.id,examDate:'2026-10-19',priority:'normal',start:'2026-10-18',replan:true});
 assert.ok(state.tasks.slice(1).every(t=>t.date==='2026-10-18'));
 for(const change of [{priority:'unknown'},{examDate:'2026-02-30'},{examDate:'2026-10-30'},{replan:true,start:'2026-10-19'}])assert.throws(()=>reduce(state,{type:'subject-update',id:subject.id,examDate:'2026-10-19',priority:'auto',...change}));
 assert.equal(JSON.parse(JSON.stringify(state)).subjects[0].priority,'normal');
});
