import {KATAKANA,hiragana,safeIPA} from './core.js';
import {initialSchedule,schedule,dueItems} from './scheduler.js';
import {StorageLock} from './storage-lock.js';
import {EXCLUDED,captureAround,sentenceAt} from './text-engine.js';
export const PREFIX='yomi:library:v1:';
const norm=text=>(text||'').normalize('NFKC').replace(/[’‘]/g,"'").replace(/[‐‑–]/g,'-').replace(/^[～~〜]/,'').trim().toLowerCase();
export const itemType=info=>info.type|| (info.lang==='en'?'english':KATAKANA.test(info.word.normalize('NFKC'))?'loanword':'vocabulary');
export function identity(info) {
  const type=itemType(info),expression=info.grammarId||info.base||info.word;
  return [type,norm(expression),type==='grammar'?'':hiragana(info.baseReading||info.reading||'')].join('|');
}
const bucket=id=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return h%64;};
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function gmStorage() {
  return {get:(k,d)=>typeof GM!=='undefined'&&GM.getValue?GM.getValue(k,d):Promise.resolve(GM_getValue(k,d)),set:(k,v)=>typeof GM!=='undefined'&&GM.setValue?GM.setValue(k,v):Promise.resolve(GM_setValue(k,v)),delete:k=>typeof GM!=='undefined'&&GM.deleteValue?GM.deleteValue(k):Promise.resolve(GM_deleteValue(k)),keys:()=>typeof GM!=='undefined'&&GM.listValues?GM.listValues():Promise.resolve(GM_listValues())};
}
export function pageContext(snapshot,info,manualSentence='') {
  const text=snapshot?.text||manualSentence||info.word,at=snapshot?.target||0;
  const sentences=[...text.matchAll(/[^。！？!?\n]+(?:[。！？!?]|$)/gu)].flatMap(m=>{
    // Split English full stops only when followed by whitespace; keep decimals intact.
    return [...m[0].matchAll(/.+?(?:\.(?=\s)|$)/gu)].filter(x=>x[0]).map(x=>({text:x[0].trim(),start:m.index+x.index,end:m.index+x.index+x[0].length}));
  });
  const index=Math.max(0,sentences.findIndex(s=>at>=s.start&&at<s.end));
  return {sentence:(sentences[index]?.text||text).slice(0,1200),previousSentence:(sentences[index-1]?.text||adjacentSentence(snapshot,true)).slice(-600),nextSentence:(sentences[index+1]?.text||adjacentSentence(snapshot,false)).slice(0,600),pageTitle:document.title,url:location.href,domain:location.hostname,encounteredAt:Date.now(),surface:info.word};
}
function adjacentSentence(snapshot,backwards) {
  if(!snapshot?.segments?.length)return '';
  const start=(backwards?snapshot.segments[0]:snapshot.segments.at(-1)).node;if(!start?.isConnected)return '';
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeType===1?n.matches(EXCLUDED)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_SKIP:NodeFilter.FILTER_ACCEPT});walker.currentNode=start;
  for(let count=0;count<12;count++){const next=backwards?walker.previousNode():walker.nextNode();if(!next)return '';if(next.nodeType!==3||!next.nodeValue.trim())continue;const css=getComputedStyle(next.parentElement);if(css.display==='none'||css.visibility==='hidden')continue;const around=captureAround(next,backwards?Math.max(0,next.length-1):0,600);if(around)return sentenceAt(around.text,around.target,600);}
  return '';
}
function searchText(item){return norm([item.expression,item.normalizedExpression,item.reading,item.sourceWord,item.meaningZh,item.meaningEn,item.grammarConnection,item.tags?.join(' '),item.notes,item.contextSearch].join(' '));}
export class LearningRepository {
  constructor(storage=gmStorage()) {
    this.storage=storage;this.lock=new StorageLock(storage,PREFIX);this.items=new Map();this.categories=[];this.aliases=new Map();this.listeners=new Set();this.encounters=new Set();this.queue=Promise.resolve();this.error='';
    this.ready=this.load().catch(e=>{this.error=e.message;throw e;});this.ready.catch(()=>{});
    if(typeof GM_addValueChangeListener==='function')GM_addValueChangeListener(PREFIX+'changed',(_k,_o,_n,remote)=>{if(remote)this.load().catch(e=>{this.error=e.message;});});
  }
  async load(){
    const shards=await Promise.all(Array.from({length:64},(_,i)=>this.storage.get(PREFIX+'index:'+i,{})));
    this.categories=await this.storage.get(PREFIX+'categories',[]);
    this.items.clear();for(const shard of shards)for(const item of Object.values(shard))this.items.set(item.id,item);
    this.reindex();this.error='';this.emit();
  }
  reindex(){this.aliases.clear();for(const item of this.items.values())for(const type of new Set([item.type,item.recognizedType||item.type])){const key=type+'|'+item.normalizedExpression;const list=this.aliases.get(key)||[];list.push(item);this.aliases.set(key,list);}}
  indexItem(item){const previous=this.items.get(item.id);if(previous)for(const type of new Set([previous.type,previous.recognizedType||previous.type])){const key=type+'|'+previous.normalizedExpression;this.aliases.set(key,(this.aliases.get(key)||[]).filter(i=>i.id!==item.id));}this.items.set(item.id,item);for(const type of new Set([item.type,item.recognizedType||item.type])){const key=type+'|'+item.normalizedExpression;this.aliases.set(key,[...(this.aliases.get(key)||[]),item]);}}
  find(info){const key=identity(info),direct=this.items.get(key);if(direct)return direct;const reading=hiragana(info.baseReading||info.reading||''),list=this.aliases.get(itemType(info)+'|'+norm(info.grammarId||info.base||info.word))||[];return list.find(i=>reading&&i.reading===reading)||(list.length===1&&(!reading||!list[0].reading)?list[0]:undefined);}
  subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  emit(){for(const fn of this.listeners)fn();}
  exclusive(fn){const task=this.queue.catch(()=>{}).then(()=>this.ready).then(()=>this.lock.run(fn));this.queue=task;return task;}
  async commit(item){
    item.searchText=searchText(item);
    // Canonical item is written first; rebuildIndex can recover an interrupted index update.
    await this.storage.set(PREFIX+'item:'+item.id,item);
    const key=PREFIX+'index:'+bucket(item.id),shard=await this.storage.get(key,{});shard[item.id]=item;await this.storage.set(key,shard);
    this.indexItem(item);this.emit();await this.storage.set(PREFIX+'changed',uid());return item;
  }
  async append(kind,item,index,value){const key=PREFIX+kind+':'+item.id+':'+Math.floor(index/50),page=await this.storage.get(key,[]);page[index%50]=value;await this.storage.set(key,page);}
  async records(kind,id,count,offset=0,limit=50){const result=[];for(let i=Math.floor(offset/50);i<=Math.floor(Math.min(count-1,offset+limit-1)/50);i++)result.push(...await this.storage.get(PREFIX+kind+':'+id+':'+i,[]));return result.slice(offset%50,offset%50+limit);}
  async getItem(id){return await this.storage.get(PREFIX+'item:'+id,this.items.get(id));}
  categoryList(){return this.categories.filter(c=>!c.deletedAt);}
  categoryIds(item){const live=new Set(this.categoryList().map(c=>c.id));return (item.categoryIds||[]).filter(id=>live.has(id));}
  categoryCounts(){const counts=new Map(this.categoryList().map(c=>[c.id,0]));let unfiled=0;for(const item of this.items.values()){const ids=(item.categoryIds||[]).filter(id=>counts.has(id));if(!ids.length)unfiled++;for(const id of ids)counts.set(id,counts.get(id)+1);}return {counts,unfiled};}
  async checkedCategories(ids){const categories=await this.storage.get(PREFIX+'categories',[]);this.categories=categories;const live=new Set(categories.filter(c=>!c.deletedAt).map(c=>c.id));if(!Array.isArray(ids)||ids.some(id=>!live.has(id)))throw new Error('选中的分类已被删除，请重新选择。');return [...new Set(ids)];}
  changeCategory(id,name,operation='rename'){return this.exclusive(async()=>{const rows=await this.storage.get(PREFIX+'categories',[]),now=Date.now();let category=rows.find(c=>c.id===id);
    if(operation==='delete'){if(!category||category.deletedAt)throw new Error('分类已不存在。');category.deletedAt=now;}
    else{const clean=String(name||'').trim();if(!clean||clean.length>40)throw new Error('分类名称需为 1–40 个字符。');if(['全部资料','未分类'].includes(clean))throw new Error('这是系统分类栏名称，请使用其他名称。');if(rows.some(c=>!c.deletedAt&&c.id!==id&&norm(c.name)===norm(clean)))throw new Error('已存在同名分类。');if(id&&!category)throw new Error('分类已不存在。');if(category?.deletedAt)throw new Error('分类已被删除。');if(!category){category={id:uid(),createdAt:now};rows.push(category);}category.name=clean;}
    category.updatedAt=now;await this.storage.set(PREFIX+'categories',rows);this.categories=rows;this.emit();await this.storage.set(PREFIX+'changed',uid());return category;
  });}
  createCategory(name){return this.changeCategory(null,name,'create');}
  deleteCategory(id){return this.changeCategory(id,'','delete');}
  setCategories(id,ids){return this.exclusive(async()=>{const categoryIds=await this.checkedCategories(ids),item=await this.getItem(id);if(!item)throw new Error('资料不存在。');return this.commit({...item,categoryIds,updatedAt:Date.now()});});}
  collect(info,entry,context,encounterKey,selectedCategories){return this.exclusive(async()=>{
    const categoryIds=selectedCategories===undefined?undefined:await this.checkedCategories(selectedCategories);
    const found=this.find(info),existing=await this.storage.get(PREFIX+'item:'+(found?.id||identity(info)));if(existing){if(categoryIds!==undefined)return this.commit({...existing,categoryIds,updatedAt:Date.now()});this.items.set(existing.id,existing);this.reindex();return existing;}
    const now=Date.now(),id=identity(info),type=itemType(info);
    const reviewExample=entry.senses?.find(s=>s.contextMatch)?.examples?.[0]||entry.senses?.[0]?.examples?.[0]||entry.examples?.[0];
    const item={id,schemaVersion:1,type,expression:type==='grammar'?(entry.grammarPattern||'～'+info.base):(info.base||info.word),normalizedExpression:norm(info.grammarId||info.base||info.word),reading:info.baseReading||info.reading||entry.reading||'',sourceWord:entry.sourceWord||entry.original||'',sourceWordConfidence:entry.sourceWordConfidence||0,meaningZh:entry.meaning||'',meaningEn:entry.meaningEn||'',jlptLevel:entry.jlptLevel||'',partOfSpeech:entry.pos||info.pos||'',explanation:entry.explanation||entry.usage||'',usage:entry.usage||'',grammarPattern:entry.grammarPattern||'',grammarConnection:entry.grammarConnection||'',language:info.lang||'',ipaUk:safeIPA(entry.ipaUk),ipaUs:safeIPA(entry.ipaUs),pronunciationWord:entry.pronunciationWord||info.word,pronunciationSource:entry.pronunciationSource||'',readingSource:entry.readingSource||'',cardInfo:Object.fromEntries(['word','base','reading','baseReading','lang','type','grammarId','pos'].filter(k=>info[k]!==undefined).map(k=>[k,info[k]])),contextMeaning:entry.contextMeaning||'',domain:entry.domain||'',collocations:entry.collocations||'',etymologyKind:entry.etymologyKind||'',source:entry.source||'用户自定义',example:entry.example||reviewExample?.text||'',translation:entry.translation||reviewExample?.translation||'',senses:(entry.senses||[]).map(s=>({...s,contextMatch:false})),examples:entry.examples||[],tags:[],notes:'',createdAt:now,updatedAt:now,lastEncounteredAt:now,encounterCount:1,contextCount:context?1:0,contextSearch:context?.sentence||'',...initialSchedule(now)};
    item.categoryIds=categoryIds||[];
    if(context)await this.append('contexts',item,0,context);
    const saved=await this.commit(item);if(encounterKey)this.encounters.add(id+'|'+encounterKey);return saved;
  });}
  encounter(info,context,key){const known=this.find(info);if(!known||this.encounters.has(known.id+'|'+key))return Promise.resolve(known);return this.exclusive(async()=>{
    const found=this.find(info);if(!found||this.encounters.has(found.id+'|'+key))return found;
    const item={...await this.getItem(found.id)},now=Date.now();
    await this.append('contexts',item,item.contextCount,context);item.contextCount++;item.encounterCount++;item.lastEncounteredAt=now;item.updatedAt=now;
    if(!item.contextSearch.includes(context.sentence))item.contextSearch+='\n'+context.sentence;
    const saved=await this.commit(item);this.encounters.add(found.id+'|'+key);return saved;
  });}
  edit(id,changes){return this.exclusive(async()=>{
    const item={...await this.getItem(id)};
    item.recognizedType ||= item.type;
    for(const key of ['meaningZh','meaningEn','tags','notes','state','jlptLevel','explanation','type','reading','ipaUk','ipaUs'])if(key in changes)item[key]=changes[key];
    if('reading' in changes){item.reading=hiragana(String(changes.reading).trim());item.readingSource='用户编辑';if(item.cardInfo?.word===item.expression)item.cardInfo.reading=item.reading;}
    if('ipaUk' in changes||'ipaUs' in changes){for(const key of ['ipaUk','ipaUs']){if(item[key]&&!safeIPA(item[key]))throw new Error('请填写有效 IPA 音标，或留空。');item[key]=safeIPA(item[key]);}item.pronunciationWord=item.expression;item.pronunciationSource='用户编辑';}
    if(!['new','learning','reviewing','mastered','suspended'].includes(item.state))throw new Error('学习状态无效。');
    if(!['vocabulary','grammar','loanword','english','custom'].includes(item.type))throw new Error('资料类型无效。');
    item.updatedAt=Date.now();return this.commit(item);
  });}
  updateKnowledge(id,entry){return this.exclusive(async()=>{
    const item=await this.getItem(id);if(!item)throw new Error('资料不存在。');
    const changed={...item,meaningZh:entry.meaning||item.meaningZh,updatedAt:Date.now()};
    for(const key of ['usage','explanation','senses','examples','example','translation','domain','collocations','contextMeaning','source','ipaUk','ipaUs','pronunciationWord','pronunciationSource'])if(entry[key]!==undefined)changed[key]=entry[key];
    changed.ipaUk=safeIPA(changed.ipaUk);changed.ipaUs=safeIPA(changed.ipaUs);
    if(changed.senses)changed.senses=changed.senses.map(s=>({...s,contextMatch:false}));
    if(entry.reading&&changed.cardInfo){changed.cardInfo={...changed.cardInfo,reading:entry.reading};if(changed.cardInfo.word===item.expression)changed.reading=entry.reading;changed.readingSource='AI 推断';}
    return this.commit(changed);
  });}
  review(id,grade,quiz,now=Date.now()){return this.exclusive(async()=>{
    const before=await this.getItem(id);if(before.nextReviewAt>now)throw new Error('该项目已完成本轮复习，请刷新待复习列表。');
    const after=schedule(before,grade,now);
    const record={id:uid(),itemId:id,reviewedAt:now,grade,quiz,before:{state:before.state,interval:before.currentInterval,easeFactor:before.easeFactor},after:{state:after.state,interval:after.currentInterval,easeFactor:after.easeFactor,nextReviewAt:after.nextReviewAt},scheduler:after.scheduler};
    await this.append('reviews',after,before.reviewCount,record);await this.commit(after);return {item:after,record};
  });}
  query({search='',filter='all',category='all',offset=0,limit=40}={}){
    const live=new Set(this.categoryList().map(c=>c.id));
    const inCategory=i=>category==='all'||(category==='unfiled'?!(i.categoryIds||[]).some(id=>live.has(id)):live.has(category)&&(i.categoryIds||[]).includes(category));
    const q=norm(search);const all=[...this.items.values()].filter(i=>inCategory(i)&&(!q||i.searchText.includes(q))&&(filter==='all'||i.type===filter||i.jlptLevel===filter||i.state===filter||(filter==='due'&&i.state!=='suspended'&&i.nextReviewAt<=Date.now()))).sort((a,b)=>b.createdAt-a.createdAt);
    return {total:all.length,items:all.slice(offset,offset+limit)};
  }
  due(now=Date.now()){return dueItems([...this.items.values()],now);}
  async rebuildIndex(){await this.queue.catch(()=>{});await this.lock.run(async()=>{const shards=Array.from({length:64},()=>({}));for(const key of await this.storage.keys())if(key.startsWith(PREFIX+'item:')){const item=await this.storage.get(key);if(item?.id)shards[bucket(item.id)][item.id]=item;}for(let i=0;i<64;i++)await this.storage.set(PREFIX+'index:'+i,shards[i]);});this.ready=this.load();await this.ready;}
}
