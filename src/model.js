export const COLORS = ['lavender', 'blue', 'mint', 'peach', 'rose'];
export const id = () => globalThis.crypto.randomUUID();
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function parseDate(key) { return new Date(key + 'T12:00:00'); }
export function addDays(key, n) { const d = parseDate(key); d.setDate(d.getDate()+n); return dateKey(d); }
export function dayDiff(a, b) { return Math.round((parseDate(a)-parseDate(b))/86400000); }
export function monday(key) { const d=parseDate(key); return addDays(key,-((d.getDay()+6)%7)); }
export function emptyState() { return {version:1, exams:[], subjects:[], tasks:[]}; }
export function distribute({name,total,unit,weekdays,start,color}, exam) {
  if (!name?.trim() || !Number.isSafeInteger(total) || total < 1 || total > 100000) throw new Error('과목명과 1~100,000 사이의 정수 분량을 입력해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(parseDate(start).getTime()) || start >= exam.start) throw new Error('공부 시작일은 시험 시작일보다 빨라야 해요.');
  const span = dayDiff(exam.start,start);
  if (span > 730) throw new Error('공부 기간은 최대 2년까지 설정할 수 있어요.');
  const dates = Array.from({length:span}, (_,i)=>addDays(start,i)).filter(d=>weekdays.includes(parseDate(d).getDay()));
  if (!dates.length) throw new Error('시험 전 공부할 수 있는 요일을 하나 이상 선택해 주세요.');
  const subject = {id:id(),examId:exam.id,name:name.trim(),total,unit:unit?.trim() || '쪽',weekdays,start,color:COLORS.includes(color)?color:'lavender'};
  const tasks = dates.map((date,i)=>({id:id(),subjectId:subject.id,examId:exam.id,title:subject.name,amount:Math.floor(total/dates.length)+(i<total%dates.length?1:0),unit:subject.unit,date,done:false,color:subject.color})).filter(t=>t.amount>0);
  return {subject,tasks};
}
export function reduce(state, action) {
  const next=structuredClone(state);
  switch(action.type) {
    case 'reset': return emptyState();
    case 'exam-add': {
      const exam=action.exam;
      if (!exam.name?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(exam.start) || !/^\d{4}-\d{2}-\d{2}$/.test(exam.end) || !Number.isFinite(parseDate(exam.start).getTime()) || !Number.isFinite(parseDate(exam.end).getTime()) || exam.end<exam.start) throw new Error('시험 이름과 올바른 시험 기간을 입력해 주세요.');
      next.exams.push(exam);
      for(const input of action.subjects) { const result=distribute(input,exam); next.subjects.push(result.subject); next.tasks.push(...result.tasks); }
      break;
    }
    case 'subject-add': {
      const exam=next.exams.find(e=>e.id===action.examId); if(!exam) throw new Error('시험을 찾을 수 없어요.');
      const result=distribute(action.subject,exam); next.subjects.push(result.subject); next.tasks.push(...result.tasks); break;
    }
    case 'exam-delete': next.exams=next.exams.filter(e=>e.id!==action.id); next.subjects=next.subjects.filter(s=>s.examId!==action.id); next.tasks=next.tasks.filter(t=>t.examId!==action.id); break;
    case 'task-save': {
      const task=action.task;
      if(!task.title?.trim()) throw new Error('할 일을 입력해 주세요.');
      if(task.date && (!/^\d{4}-\d{2}-\d{2}$/.test(task.date) || !Number.isFinite(parseDate(task.date).getTime()))) throw new Error('날짜를 확인해 주세요.');
      if(task.amount!==null && task.amount!==undefined && (!Number.isSafeInteger(task.amount)||task.amount<1||task.amount>100000)) throw new Error('분량은 1~100,000 사이의 정수로 입력해 주세요.');
      const at=next.tasks.findIndex(t=>t.id===task.id);
      if(at<0) next.tasks.push(task); else next.tasks[at]={...next.tasks[at],...task}; break;
    }
    case 'task-toggle': { const t=next.tasks.find(t=>t.id===action.id); if(t) t.done=!t.done; break; }
    case 'task-date': { const t=next.tasks.find(t=>t.id===action.id); if(t) { t.date=action.date; t.done=false; } break; }
    case 'task-delete': next.tasks=next.tasks.filter(t=>t.id!==action.id); break;
    default: throw new Error('지원하지 않는 변경이에요.');
  }
  return next;
}
