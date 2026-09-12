export const MINUTE=60_000, DAY=86_400_000;
export const GRADES=['again','hard','good','easy'];
export function initialSchedule(now=Date.now()) {
  return {state:'new',reviewCount:0,correctCount:0,incorrectCount:0,lapseCount:0,lastReviewedAt:null,nextReviewAt:now,currentInterval:0,easeFactor:2.5,memoryStrength:0,scheduler:{algorithm:'yomi-adaptive',version:1,fsrs:null}};
}
// currentInterval is always in DAYS, including the ten-minute learning step.
export function schedule(item,grade,now=Date.now()) {
  if(!GRADES.includes(grade))throw new Error('未知复习评价。');
  if(item.state==='suspended')throw new Error('请先恢复暂停的项目。');
  const old=item.currentInterval||0,ease=item.easeFactor||2.5;
  let interval,state='reviewing',nextEase=ease;
  if(grade==='again'){interval=10*MINUTE/DAY;state='learning';nextEase=Math.max(1.3,ease-.2);}
  else if(grade==='hard'){interval=old<1?Math.max(10*MINUTE/DAY,old*1.3):old*1.3;state=interval<1?'learning':'reviewing';nextEase=Math.max(1.3,ease-.15);}
  else if(grade==='good'){interval=old<1?1:old===1?3:old*Math.max(2,Math.min(2.5,ease));}
  else{interval=old<1?3:old*Math.max(3,Math.min(4,ease+1));nextEase=Math.min(3.5,ease+.15);}
  interval=Math.min(3650,interval<1?interval:Math.round(interval*10)/10);
  if(interval>=60 && item.reviewCount>=5 && grade!=='again')state='mastered';
  return {...item,state,reviewCount:item.reviewCount+1,correctCount:item.correctCount+(grade==='again'?0:1),incorrectCount:item.incorrectCount+(grade==='again'?1:0),lapseCount:item.lapseCount+(grade==='again'&&old>=1?1:0),lastReviewedAt:now,nextReviewAt:now+interval*DAY,currentInterval:interval,easeFactor:nextEase,memoryStrength:Math.round(Math.log2(1+interval)*100)/100,updatedAt:now,scheduler:{algorithm:'yomi-adaptive',version:1,fsrs:item.scheduler?.fsrs||null}};
}
export const intervalLabel=days=>days<1?`${Math.max(1,Math.round(days*1440))} 分钟`:`${days} 天`;
export function dueItems(items,now=Date.now(),newLimit=20) {
  const eligible=items.filter(i=>i.state!=='suspended'&&i.nextReviewAt<=now);
  return [...eligible.filter(i=>i.state!=='new').sort((a,b)=>a.nextReviewAt-b.nextReviewAt),...eligible.filter(i=>i.state==='new').sort((a,b)=>a.createdAt-b.createdAt).slice(0,newLimit)];
}
