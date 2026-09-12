import test from 'node:test';import assert from 'node:assert/strict';import kuromoji from 'kuromoji';
import {safeOriginal,safeReading} from '../src/annotation.js';import {validateEntry} from '../src/core.js';
import {grammarMatches,grammars} from '../src/grammar.js';import {candidatesAt} from '../src/text-engine.js';
import {identity,LearningRepository,PREFIX,pageContext} from '../src/learning.js';
import {initialSchedule,schedule,DAY,dueItems} from '../src/scheduler.js';import {makeQuiz} from '../src/quiz.js';
import {AIClient} from '../src/network.js';
const memory=()=>{const map=new Map();return {map,reads:0,async get(k,d){this.reads++;return structuredClone(map.get(k)??d);},async set(k,v){map.set(k,structuredClone(v));},async keys(){return [...map.keys()];}};};
test('annotation trust boundary rejects definitions, excessive length, low confidence and invented forms',()=>{
 for(const sourceWord of ['代理；智能体','a'.repeat(1000),'this is a very long definition','power / strength','agent（英语）','<img>'])assert.equal(safeOriginal({sourceWord,sourceWordConfidence:1,etymologyKind:'borrowed'}),'');
 assert.equal(safeOriginal({sourceWord:'agent',sourceWordConfidence:.8}),'');assert.equal(safeOriginal({sourceWord:'agent',sourceWordConfidence:1,etymologyKind:'proper'}),'');
 for(const sourceWordConfidence of ['0.99','invalid',NaN,Infinity,2])assert.equal(safeOriginal({sourceWord:'agent',sourceWordConfidence,etymologyKind:'borrowed'}),'');
 assert.equal(safeOriginal({sourceWord:'data center',sourceWordConfidence:.95,etymologyKind:'borrowed'}),'data center');assert.equal(safeOriginal(validateEntry({meaning:'测试',original:'agent'})),'');assert.equal(safeReading('这是读音解释'),'');
});
test('all 14 grammar patterns match real IPADIC connections, complete offsets and canonical variants',async()=>{
 const tokenizer=await new Promise((resolve,reject)=>kuromoji.builder({dicPath:'node_modules/kuromoji/dict'}).build((e,t)=>e?reject(e):resolve(t)));
 for(const [id,entry]of grammars){const result=grammarMatches(entry.example,tokenizer);assert.ok(result.some(g=>g.grammarId===id),`${id}: ${JSON.stringify(result)}`);const found=result.find(g=>g.grammarId===id);for(let i=found.start;i<found.end;i++)assert.equal(candidatesAt({text:entry.example,lang:'ja',target:i},'auto',tokenizer)[0].grammarId,id);}
 for(const form of ['を踏まえ','を踏まえて','を踏まえた'])assert.equal(grammarMatches('事実'+form+'判断する。',tokenizer)[0].grammarId,'を踏まえて');
 for(const text of ['ものの色が違う。','荷物のことから先に片付けよう。','ことになる。','どこまで行く。','ところにいる。'])assert.equal(grammarMatches(text,tokenizer).length,0,text);
 const a=candidatesAt({text:'経験を踏まえた。',target:4,lang:'ja'},'auto',tokenizer)[0];assert.equal(a.type,'grammar');
 const verb=candidatesAt({text:'経験を踏まえる。',target:4,lang:'ja'},'auto',tokenizer)[0];assert.equal(verb.base,'踏まえる');
});
test('collect, lemma dedup, natural encounters, paged contexts and formal reviews survive repository reload',async()=>{
 const storage=memory(),repo=new LearningRepository(storage);await repo.ready;const info={word:'食べました',base:'食べる',reading:'たべました',baseReading:'たべる',lang:'ja'},context={sentence:'パンを食べました。',surface:'食べました',url:'https://a.example/article',previousSentence:'前の文。',nextSentence:'次の文。'};
 const item=await repo.collect(info,{meaning:'吃',meaningEn:'eat'},context,'page-a');assert.equal(item.encounterCount,1);assert.equal(item.reading,'たべる');
 assert.equal(identity(info),identity({...info,word:'食べる',reading:'たべる'}));assert.equal((await repo.collect(info,{meaning:'吃'},context)).id,item.id);assert.equal(repo.items.size,1);
 await repo.encounter(info,context,'page-a');assert.equal(repo.find(info).encounterCount,1);await repo.encounter(info,{...context,url:'https://b.example'},'page-b');await repo.encounter(info,context,'page-b');assert.equal(repo.find(info).encounterCount,2);assert.equal(repo.find(info).reviewCount,0);
 await repo.edit(item.id,{tags:['金融','重要'],notes:'复习用',meaningEn:'consider; eat'});assert.equal(repo.query({search:'consider'}).total,1);assert.equal(repo.query({search:'パンを食べ'}).total,1);assert.equal(repo.query({search:'金融'}).total,1);
 const result=await repo.review(item.id,'good',{mode:'cloze'},Date.now()+10);assert.equal(result.item.currentInterval,1);assert.equal(result.item.reviewCount,1);assert.equal(result.item.encounterCount,2);assert.equal((await repo.records('reviews',item.id,1))[0].grade,'good');
 const second=new LearningRepository(storage);await second.ready;assert.equal(second.items.size,1);assert.equal(second.find(info).reviewCount,1);assert.equal((await second.records('contexts',item.id,2)).length,2);assert.equal(second.due().length,0);
});
test('scheduler is adaptive, separates lapses, rejects early duplicate formal review and supports suspension',()=>{
 const now=1_000_000,start=initialSchedule(now);for(const grade of ['again','hard','good','easy']){const next=schedule(start,grade,now);assert.ok(next.nextReviewAt>now);assert.equal(next.reviewCount,1);}
 let item=schedule({...start,currentInterval:7,state:'reviewing',reviewCount:4},'again',now);assert.equal(item.lapseCount,1);assert.equal(item.incorrectCount,1);assert.equal(item.state,'learning');assert.equal(Math.round(item.currentInterval*1440),10);
 const old={...start,currentInterval:7,state:'reviewing'};assert.ok(schedule(old,'easy').currentInterval>schedule(old,'good').currentInterval);assert.ok(schedule(old,'good').currentInterval>schedule(old,'hard').currentInterval);
 assert.throws(()=>schedule({...start,state:'suspended'},'good'));assert.equal(dueItems([{...start,id:'a',state:'suspended'},{...start,id:'b'}],now).length,1);assert.equal(schedule(start,'good',now).nextReviewAt,now+DAY);
});
test('all five quiz modes use saved real context when applicable',()=>{
 const item={id:'g',...grammars.get('ものの'),expression:'～ものの',meaningZh:'虽然……但是……',reviewCount:2};const contexts=[{sentence:'改善したものの、消費は弱い。',surface:'ものの',url:'https://read.example'}];
 for(const mode of ['forward','reverse','cloze','grammar','context']){const quiz=makeQuiz(item,contexts,mode);assert.equal(quiz.mode,mode);assert.equal(quiz.contextSource,contexts[0].url);if(mode==='cloze'||mode==='grammar')assert.ok(quiz.prompt.includes('＿＿＿＿'));if(mode==='grammar')assert.equal(quiz.choices.filter(c=>c===quiz.correct).length,1);}
});
test('two page repositories serialize concurrent writes and do not duplicate the same learning item',async()=>{
 const storage=memory(),a=new LearningRepository(storage),b=new LearningRepository(storage);await Promise.all([a.ready,b.ready]);
 const info={word:'power',base:'power',lang:'en'};
 await Promise.all([a.collect(info,{meaning:'力量'},{sentence:'power',url:'https://a.example',surface:'power'}),b.collect(info,{meaning:'力量'},{sentence:'power',url:'https://b.example',surface:'power'})]);
 await Promise.all([a.load(),b.load()]);assert.equal(a.items.size,1);assert.equal(b.items.size,1);
 await Promise.all([a.encounter(info,{sentence:'More power.',surface:'power',url:'https://a.example'},'a2'),b.encounter(info,{sentence:'Some power.',surface:'power',url:'https://b.example'},'b2')]);
 await a.load();assert.equal(a.find(info).encounterCount,3);assert.equal(a.find(info).contextCount,3);
 const item=a.find(info);await a.review(item.id,'good',{mode:'forward'});await assert.rejects(b.review(item.id,'good',{mode:'forward'}),/已完成本轮/);
});
test('A B C D responses arriving C D B A cannot revive canceled subscriptions; shared requests survive one subscriber cancellation',async()=>{
 const sent=[],client=new AIClient(()=>({aiEnabled:true,endpoint:'https://test.example/chat/completions',model:'test-only'}));
 globalThis.GM_xmlhttpRequest=options=>{sent.push(options);return {abort(){/* Deliberately emulate a server that cannot stop its response. */}};};
 const jobs=[];let controller;
 for(const word of ['A','B','C','D']){controller?.abort();controller=new AbortController();jobs.push(client.lookup({word,base:word,lang:'en'},'',false,controller.signal).catch(e=>e.name));await new Promise(r=>setTimeout(r,0));}
 assert.equal(sent.length,4);for(const index of [2,3,1,0])sent[index].onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify({meaning:['A','B','C','D'][index]})}}]})});
 const results=await Promise.all(jobs);assert.deepEqual(results.slice(0,3),['AbortError','AbortError','AbortError']);assert.equal(results[3].meaning,'D');assert.equal(client.cache.map.size,1);assert.equal(client.active,0);
 const a=new AbortController(),b=new AbortController(),first=client.lookup({word:'shared',lang:'en'},'',false,a.signal).catch(e=>e.name),second=client.lookup({word:'shared',lang:'en'},'',false,b.signal);assert.equal(sent.length,5);a.abort();sent[4].onload({status:200,responseText:JSON.stringify({choices:[{message:{content:'{"meaning":"shared"}'}}]})});assert.equal(await first,'AbortError');assert.equal((await second).meaning,'shared');
});
test('initial storage failure is recoverable through index repair and parser failures keep text candidates',async()=>{
 const storage=memory();let failing=true;const get=storage.get.bind(storage);storage.get=async(...args)=>{if(failing)throw new Error('unavailable');return get(...args);};const repo=new LearningRepository(storage);await assert.rejects(repo.ready);failing=false;await repo.rebuildIndex();await repo.collect({word:'hello',base:'hello',lang:'en'},{meaning:'你好'},null);assert.equal(repo.items.size,1);
 assert.ok(candidatesAt({text:'市場を調べる。',target:0,lang:'ja'},'auto',{tokenize(){throw new Error('broken analyzer');}}).length);
});
test('10k items / 50k contexts / 100k review records: initial index and category load is 65 reads and hover lookup performs no storage I/O',async()=>{
 const storage=memory(),shards=Array.from({length:64},()=>({}));
 for(let i=0;i<10_000;i++){const id=`english|word${i}|`,item={id,type:'english',normalizedExpression:`word${i}`,expression:`word${i}`,reading:'',meaningZh:'测试',searchText:`word${i} 测试`,contextCount:5,reviewCount:10,...initialSchedule(0)};shards[i%64][id]=item;storage.map.set(PREFIX+'contexts:'+id+':0',Array.from({length:5},(_,n)=>({sentence:`Sentence ${i}-${n}`,url:'https://example.org'})));storage.map.set(PREFIX+'reviews:'+id+':0',Array.from({length:10},(_,n)=>({id:`${i}-${n}`,grade:'good',reviewedAt:n})));}
 shards.forEach((s,i)=>storage.map.set(PREFIX+'index:'+i,s));const repo=new LearningRepository(storage);await repo.ready;assert.equal(repo.items.size,10000);const reads=storage.reads;assert.equal(reads,65);
 for(let i=0;i<10000;i++)assert.ok(repo.find({word:`word${i}`,base:`word${i}`,lang:'en'}));assert.equal(storage.reads,reads);assert.equal(repo.query({search:'word9999'}).total,1);
 assert.equal((await repo.records('contexts','english|word9999|',5)).length,5);assert.equal(storage.reads,reads+1);
});
