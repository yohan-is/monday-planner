export const COLORS = ['lavender', 'blue', 'mint', 'peach', 'rose'];
export const id = () => globalThis.crypto.randomUUID();
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function parseDate(key) { return new Date(key + 'T12:00:00'); }
export function addDays(key, n) { const d = parseDate(key); d.setDate(d.getDate()+n); return dateKey(d); }
export function dayDiff(a, b) { return Math.round((parseDate(a)-parseDate(b))/86400000); }
export function monday(key) { const d=parseDate(key); return addDays(key,-((d.getDay()+6)%7)); }
export function emptyState() { return {version:1, exams:[], subjects:[], tasks:[]}; }
export const SCOPE_UNITS = ['단원', '챕터', '주차'];
export const PRIORITIES = {auto:'자동',high:'높음',normal:'보통',low:'낮음'};
const validDate = key => /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(parseDate(key).getTime()) && dateKey(parseDate(key)) === key;
export function scopeLabel(from,to,unit) { return `${from}${from===to?'':'–'+to}${unit}`; }
export function studyDays(subject,today=dateKey()) { return Math.max(0,dayDiff(subject.examDate,subject.start>today?subject.start:today)); }
export function compareSubjects(a,b,today=dateKey()) {
  const pastA=Boolean(a.examDate&&a.examDate<today),pastB=Boolean(b.examDate&&b.examDate<today);
  const rank={high:0,auto:1,normal:1,low:2};
  return Number(pastA)-Number(pastB)||(rank[a.priority||'auto']-rank[b.priority||'auto'])||
    (studyDays(a,today)-studyDays(b,today))||(a.examDate||'9999').localeCompare(b.examDate||'9999')||a.name.localeCompare(b.name,'ko');
}
function schedule(tasks,start,examDate) {
  if (!validDate(start) || start>=examDate) throw new Error('공부 시작일은 과목 시험일보다 빨라야 해요.');
  const span=dayDiff(examDate,start);
  if(span>730) throw new Error('공부 기간은 최대 2년까지 설정할 수 있어요.');
  tasks.forEach((task,i)=>{task.date=addDays(start,tasks.length===1?0:Math.floor(i*(span-1)/(tasks.length-1)));});
}
export function distribute({name,rangeStart,rangeEnd,unit,splits,rounds,start,examDate,color,priority='auto'}, exam) {
  examDate ??= exam.start;
  if (!name?.trim()) throw new Error('과목명을 입력해 주세요.');
  if (!SCOPE_UNITS.includes(unit) || !Number.isSafeInteger(rangeStart) || !Number.isSafeInteger(rangeEnd) || rangeStart<1 || rangeEnd<rangeStart || rangeEnd>1000) throw new Error('시험 범위는 1~1,000 사이의 번호로 입력해 주세요.');
  const total=rangeEnd-rangeStart+1;
  if (!Number.isSafeInteger(rounds) || rounds<1 || rounds>20) throw new Error('목표 회독 수는 1~20회로 입력해 주세요.');
  if (!Object.hasOwn(PRIORITIES,priority)) throw new Error('중요도를 확인해 주세요.');
  if (!validDate(examDate) || examDate<exam.start || examDate>exam.end) throw new Error('과목 시험일은 등록한 시험 기간 안으로 선택해 주세요.');
  if (!validDate(start) || start >= examDate) throw new Error('공부 시작일은 과목 시험일보다 빨라야 해요.');
  const span = dayDiff(examDate,start);
  if (span > 730) throw new Error('공부 기간은 최대 2년까지 설정할 수 있어요.');
  const autoSplit=splits===undefined||splits===null||splits==='';
  if(autoSplit)splits=Math.min(total,Math.max(1,Math.floor(span/rounds)));
  if (!Number.isSafeInteger(splits) || splits<1 || splits>total) throw new Error('한 회독을 나눌 횟수는 시험 범위 개수 이내로 입력해 주세요.');
  const subject = {id:id(),examId:exam.id,name:name.trim(),total,rangeStart,rangeEnd,unit,splits,autoSplit,rounds,start,examDate,priority,color:COLORS.includes(color)?color:'lavender'};
  const sessions=splits*rounds;
  const tasks=Array.from({length:sessions},(_,i)=>{
    const part=i%splits,amount=Math.floor(total/splits)+(part<total%splits?1:0);
    const from=rangeStart+part*Math.floor(total/splits)+Math.min(part,total%splits);
    return {id:id(),subjectId:subject.id,examId:exam.id,title:subject.name,amount,unit,rangeStart:from,rangeEnd:from+amount-1,round:Math.floor(i/splits)+1,session:part+1,done:false,color:subject.color};
  });
  schedule(tasks,start,examDate);
  return {subject,tasks};
}
export function reduce(state, action) {
  const next=structuredClone(state);
  switch(action.type) {
    case 'reset': return emptyState();
    case 'exam-add': {
      const exam=action.exam;
      if (!exam.name?.trim() || !validDate(exam.start) || !validDate(exam.end) || exam.end<exam.start) throw new Error('시험 이름과 올바른 시험 기간을 입력해 주세요.');
      next.exams.push(exam);
      for(const input of action.subjects) { const result=distribute(input,exam); next.subjects.push(result.subject); next.tasks.push(...result.tasks); }
      break;
    }
    case 'subject-add': {
      const exam=next.exams.find(e=>e.id===action.examId); if(!exam) throw new Error('시험을 찾을 수 없어요.');
      const result=distribute(action.subject,exam); next.subjects.push(result.subject); next.tasks.push(...result.tasks); break;
    }
    case 'subject-update': {
      const subject=next.subjects.find(s=>s.id===action.id);
      if(!subject)throw new Error('과목을 찾을 수 없어요.');
      const exam=next.exams.find(e=>e.id===subject.examId);
      if(!validDate(action.examDate)||action.examDate<exam.start||action.examDate>exam.end)throw new Error('과목 시험일은 등록한 시험 기간 안으로 선택해 주세요.');
      if(!Object.hasOwn(PRIORITIES,action.priority))throw new Error('중요도를 확인해 주세요.');
      if(action.replan||subject.examDate!==action.examDate){
        const pending=next.tasks.filter(t=>t.subjectId===subject.id&&!t.done).sort((a,b)=>(a.round||0)-(b.round||0)||(a.session||0)-(b.session||0)||(a.date||'').localeCompare(b.date||''));
        if(pending.length){schedule(pending,action.start,action.examDate);subject.start=action.start;}
      }
      subject.examDate=action.examDate;subject.priority=action.priority;
      break;
    }
    case 'exam-delete': next.exams=next.exams.filter(e=>e.id!==action.id); next.subjects=next.subjects.filter(s=>s.examId!==action.id); next.tasks=next.tasks.filter(t=>t.examId!==action.id); break;
    case 'task-save': {
      const task=action.task;
      if(!task.title?.trim()) throw new Error('할 일을 입력해 주세요.');
      if(task.date && !validDate(task.date)) throw new Error('날짜를 확인해 주세요.');
      if(task.rangeStart!==undefined && (!Number.isSafeInteger(task.rangeStart)||!Number.isSafeInteger(task.rangeEnd)||task.rangeStart<1||task.rangeEnd<task.rangeStart||task.rangeEnd>1000)) throw new Error('공부 범위의 시작과 끝 번호를 확인해 주세요.');
      if(task.amount!==null && task.amount!==undefined && (!Number.isSafeInteger(task.amount)||task.amount<1||task.amount>100000)) throw new Error('분량은 1~100,000 사이의 정수로 입력해 주세요.');
      const at=next.tasks.findIndex(t=>t.id===task.id);
      if(at<0) next.tasks.push(task); else next.tasks[at]={...next.tasks[at],...task}; break;
    }
    case 'task-toggle': { const t=next.tasks.find(t=>t.id===action.id); if(t) t.done=!t.done; break; }
    case 'task-date': { if(action.date && !validDate(action.date)) throw new Error('날짜를 확인해 주세요.'); const t=next.tasks.find(t=>t.id===action.id); if(t) { t.date=action.date; t.done=false; } break; }
    case 'task-delete': next.tasks=next.tasks.filter(t=>t.id!==action.id); break;
    default: throw new Error('지원하지 않는 변경이에요.');
  }
  return next;
}
