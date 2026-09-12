import {withPronunciation} from './pronunciation.js';
import { HAN, KANA, KATAKANA, hiragana, rubyParts, validateEndpoint, LRU } from './core.js';
import { loans, localEntry } from './lexicon.js';
import { AIClient } from './network.js';
import { loadTokenizer, clearDictionaryCache } from './tokenizer.js';
import { createUI } from './ui.js';
import { safeOriginal, safeReading } from './annotation.js';
import { createHighlights } from './highlight.js';
import { createAnnotationOverlay } from './annotation-overlay.js';
import { grammarMatches } from './grammar.js';
import { LearningRepository, pageContext } from './learning.js';
import { EXCLUDED, excluded, captureAround, pointText, rangeFor, analyze, candidatesAt, sentenceAt, selectedText, normalizeMapped, hasAnnotationRoom } from './text-engine.js';

(() => {
  'use strict';
  if(document.querySelector('[data-yomi-root]') || !document.body)return;
  const defaults={aiEnabled:false,endpoint:'',apiKey:'',model:'',aiCompatibility:'auto',sendContext:false,autoOriginals:false,rubySize:.55,rubyOpacity:.55,annotationEnabled:true,theme:'auto',hoverDelay:250};
  const siteKey=`yomi:site:${location.hostname}`;
  let config={...defaults,...GM_getValue('yomi:config',{}),siteEnabled:true,mode:'auto',...GM_getValue(siteKey,{})};
  let ai=new AIClient(()=>config),tokenizer=null,tokenizerError='',tokenizerJob=null;
  const originals=new LRU(300),basicCache=new LRU(500),meta=new WeakMap(),annotated=new Set();
  const pendingRoots=new Set(),autoPending=new Set(),autoTried=new Set(),deferredNodes=new Set();
  let generation=0,requestID=0,current=null,hoverTimer,hideTimer,hoverKey='',pointerDown=false,lastPoint=null,queryController;
  const library=new LearningRepository(),highlights=createHighlights();
  const annotationOverlay=createAnnotationOverlay(()=>config);
  let processing=false,scheduled=false,autoBusy=false,autoCount=0,autoTimer,wordCount=0;
  const style=document.createElement('style');style.dataset.yomiUi='';document.documentElement.append(style);
  function setStyle(){style.textContent=`[data-yomi-token]{font:inherit;color:inherit;text-decoration:inherit;cursor:help;transition:background-color 140ms ease-out,text-decoration-color 140ms ease-out} [data-yomi-token] ruby{display:inline!important;position:relative!important;font:inherit!important;color:inherit!important} [data-yomi-token] rt{display:block!important;position:absolute!important;bottom:1.9em!important;left:50%!important;transform:translateX(-50%)!important;max-width:calc(100% / ${config.rubySize} + .4em)!important;overflow:hidden!important;white-space:nowrap!important;font-family:inherit!important;font-size:${config.rubySize}em!important;font-weight:400!important;opacity:${config.rubyOpacity}!important;color:inherit!important;line-height:1!important;text-align:center!important;user-select:none!important;pointer-events:none!important} [data-yomi-token][data-ai-original] rt{text-decoration:underline dotted!important} [data-yomi-grammar]{text-decoration:underline!important;text-decoration-color:#87977a70!important;text-underline-offset:.18em} ::highlight(yomi-hover){background-color:#859b7333;text-decoration:underline;text-decoration-color:#738565} ::highlight(yomi-active){background-color:#859b7326;text-decoration:underline;text-decoration-color:#667b52} @media(prefers-reduced-motion:reduce){[data-yomi-token]{transition:none}}`;}
  function scheduleHide(){clearTimeout(hideTimer);if(current)return;const id=requestID;hideTimer=setTimeout(()=>{if(requestID===id)ui.closeTip(false);},280);}
  function formConfig(form){
    const next={...config,...form,rubySize:Number(form.rubySize),rubyOpacity:Number(form.rubyOpacity),hoverDelay:Number(form.hoverDelay)};
    if(!(next.rubySize>=.35&&next.rubySize<=.85&&next.rubyOpacity>=.2&&next.rubyOpacity<=1&&next.hoverDelay>=150&&next.hoverDelay<=700))throw new Error('请检查注音比例、透明度及悬浮延迟范围。');
    next.endpoint=next.endpoint.trim();next.model=next.model.trim();next.apiKey=next.apiKey.trim();
    if(next.aiEnabled){next.endpoint=validateEndpoint(next.endpoint);if(!next.model)throw new Error('启用 AI 前请填写模型名称。');}
    return next;
  }
  const ui=createUI({
    onOpenSaved:openSaved,
    readingsReady:()=>!!tokenizer,
    cardReading:text=>{if(!tokenizer)return "";try{return safeReading(hiragana(tokenizer.tokenize(text).map(t=>t.reading||t.surface_form).join("")));}catch{return "";}},
    prepareReadings:async text=>{if(!HAN.test(text)||tokenizerError)return false;try{await ensureTokenizer();return true;}catch{return false;}},
    repository:library,
    getConfig:()=>config,
    exampleCandidates(text,offset){return candidatesAt({text,target:offset,lang:KANA.test(text)||HAN.test(text)?'ja':'en'},'auto',tokenizer);},
    exampleGrammar(text){const mapped=normalizeMapped(text);return grammarMatches(mapped.text,tokenizer).map(g=>{const start=mapped.starts[g.start],end=mapped.ends[g.end-1];return {...g,start,end,word:text.slice(start,end)};});},
    exampleBasic:info=>basic(info),
    async exampleLookup(info,context,signal,force=false){
      const entry=basic(info);if(entry&&!force)return entry;
      if(!config.aiEnabled){if(force)throw new Error('尚未配置 AI。请在设置的「AI 服务」中填写接口地址、密钥和模型。');return null;}
      return ai.lookup(info,config.sendContext?sentenceAt(context,info.start||0):'',force,signal);
    },
    async exampleCollect(info,entry,text){const context={...pageContext({text,target:info.start||0},info),origin:'card-example'};return ui.collect(info,entry,context,'example|'+context.url+'|'+text+'|'+info.base);},
    onCloseTip(){requestID++;queryController?.abort();current=null;hoverKey='';highlights.clear();clearTimeout(hoverTimer);clearTimeout(hideTimer);},
    onEnterTip(){highlights.set('hover');clearTimeout(hideTimer);clearTimeout(hoverTimer);},onLeaveTip:scheduleHide,
    onManual(text){manualQuery(text);},onCandidate(candidate){if(current)activate({...current,info:candidate,anchor:anchorFor(current.snapshot,candidate,current.anchor)},true);},
    onSave(form){config=formConfig(form);const {siteEnabled,mode,...globalConfig}=config;GM_setValue('yomi:config',globalConfig);GM_setValue(siteKey,{siteEnabled,mode});ai=new AIClient(()=>config);originals.map.clear();autoTried.clear();autoCount=0;setStyle();ui.updateTheme();reset();ui.status(config.siteEnabled?'设置已保存 · 查询入口就绪':'本站已暂停');},
    async onTest(form){const testConfig=formConfig({...form,aiEnabled:true});ui.status('连接测试中…');const result=await new AIClient(()=>testConfig).lookup({word:'hello',base:'hello',lang:'en'});ui.status(`连接成功：${result.meaning.slice(0,45)} · 请保存设置`);},
    onRescan(){tokenizerError='';reset();},
    onClear(){clearDictionaryCache();basicCache.map.clear();ai.cache.map.clear();originals.map.clear();ui.status('缓存已清理 · 当前内存词典刷新后释放');},
  });
  function ensureTokenizer(){
    if(tokenizer)return Promise.resolve(tokenizer);
    if(tokenizerError)return Promise.reject(new Error(tokenizerError));
    if(!tokenizerJob)tokenizerJob=loadTokenizer(s=>ui.status(s)).then(t=>tokenizer=t).catch(e=>{tokenizerError=e.message;ui.status(`注音词典不可用 · 悬浮查询仍可使用。${e.message}`);throw e;}).finally(()=>{tokenizerJob=null;});
    return tokenizerJob;
  }
  function entryFromSaved(saved,info){return withPronunciation(info,{meaning:saved.meaningZh,meaningEn:saved.meaningEn,reading:saved.reading,original:saved.sourceWord,sourceWord:saved.sourceWord,sourceWordConfidence:saved.sourceWordConfidence,usage:saved.usage,explanation:saved.explanation,example:saved.example,translation:saved.translation,senses:saved.senses,examples:saved.examples,pos:saved.partOfSpeech,grammarPattern:saved.grammarPattern,grammarConnection:saved.grammarConnection,jlptLevel:saved.jlptLevel,ipaUk:saved.ipaUk,ipaUs:saved.ipaUs,pronunciationWord:saved.pronunciationWord,pronunciationSource:saved.pronunciationSource,readingSource:saved.readingSource,domain:saved.domain,collocations:saved.collocations,etymologyKind:saved.etymologyKind,source:'Library · '+saved.source});}
  function basic(info){const saved=library.find(info);if(saved)return entryFromSaved(saved,info);const key=JSON.stringify([info.lang,info.word,info.base]);let entry=basicCache.get(key);if(entry===undefined){entry=localEntry(info)||null;basicCache.set(key,entry);}return withPronunciation(info,entry);}
  async function openSaved(itemId){
    queryController?.abort();clearTimeout(hoverTimer);clearTimeout(hideTimer);const id=++requestID;highlights.clear();
    const item=await library.getItem(itemId);if(!item)throw new Error('这条资料已不存在。');
    const word=item.cardInfo?.word||item.expression.replace(/^[～~]/,'');
    const lang=['ja','en'].includes(item.language)?item.language:item.type==='english'?'en':/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(word)?'ja':/^[A-Za-z][A-Za-z -]*$/.test(word)?'en':'custom';
    const info={word,base:item.normalizedExpression,lang,type:item.recognizedType||item.type,reading:item.reading,...item.cardInfo,method:'Library · 已收录资料'};info.lang=lang;
    const contexts=await library.records('contexts',item.id,item.contextCount,0,1),context=contexts[0]||null;
    if(lang==='ja'&&!info.reading){try{const t=await ensureTokenizer();info.reading=safeReading(hiragana(t.tokenize(word).map(x=>x.reading||x.surface_form).join('')));}catch{}}
    if(id!==requestID)return;
    const entry={...entryFromSaved(item,info),contextMeaning:item.contextMeaning||''};
    const record={info,fromLibrary:true,savedId:item.id,savedEntry:entry,candidates:[],context:context?.sentence||'',pageContext:context,snapshot:null,anchor:()=>({left:innerWidth-30,right:innerWidth-20,top:50,bottom:70}),note:'查阅已收录资料，不计为自然遇见或正式复习。'};
    current=record;show(record,entry,{pin:true,expand:true});
  }
  function anchorFor(snapshot,info,fallback){
    if(!snapshot)return fallback;
    const range=rangeFor(snapshot,info.start,info.end);
    if(!range)return fallback;
    const point=lastPoint;
    return ()=>{
      const rects=[...range.getClientRects()].filter(b=>b.width>0);
      return rects.find(b=>point&&point.y>=b.top&&point.y<=b.bottom) || rects[0] || range.getBoundingClientRect();
    };
  }
  function show(record,entry,options={}){
    if(record.info.lang==='ja'&&!record.info.reading&&tokenizer){try{record.info.reading=safeReading(hiragana(tokenizer.tokenize(record.info.word).map(t=>t.reading||t.surface_form).join('')));}catch{}}
    record.lastEntry=entry;record.lastOptions=options;
    const saved=library.find(record.info);
    const actions=[['AI 解释 ↗',()=>{
      if(config.aiEnabled)activate(record,true,true);
      else show(record,entry,{error:'尚未配置 AI。请在设置的「AI 服务」中填写接口地址、密钥和模型。',extraAction:['配置 AI',()=>ui.openSettings()]});
    }],['调整范围',()=>ui.showAdjust()]];
    if(options.extraAction)actions.push(options.extraAction);
    if(entry)actions.push([saved?'✓ 已收录 · 分类':'＋ 收录',async()=>{try{await ui.collect(record.info,entry,record.pageContext||pageContext(record.snapshot,record.info,record.context),record.encounterKey);if(current===record)show(record,entry,options);}catch(e){if(current===record)show(record,entry,{...options,error:'资料库保存失败：'+e.message});}}]);
    if(record.fromLibrary&&entry&&entry!==record.savedEntry)actions.push(['保存本次补充',async()=>{try{await library.updateKnowledge(record.savedId,entry);record.savedEntry=entry;if(current===record)show(record,entry,options);}catch(e){if(current===record)show(record,entry,{...options,error:e.message});}}]);
    if(record.fromLibrary){actions.push(['← 返回资料库',()=>ui.resumeLibrary()],['编辑资料',()=>ui.editSaved(record.savedId)]);}else actions.push(['Library ↗',()=>ui.openLibrary()]);
    ui.show(record.anchor,record.info,entry,{candidates:record.candidates,analysisNote:record.note,context:record.context,contextOrigin:record.fromLibrary?record.pageContext:null,fromLibrary:record.fromLibrary,actions,saved,...options});
  }
  async function activate(record,pin=false,forceAI=false){
    if(!config.siteEnabled)return;
    queryController?.abort();queryController=new AbortController();const signal=queryController.signal;
    const id=++requestID,version=generation;current=record;
    highlights.set('active',record.snapshot,record.info);
    if(!record.fromLibrary){record.pageContext=pageContext(record.snapshot,record.info,record.context);
    record.encounterKey=record.pageContext.url.split('#')[0]+'|'+record.pageContext.sentence+'|'+record.info.base;
    library.ready.then(()=>library.encounter(record.info,record.pageContext,record.encounterKey)).then(saved=>{if(saved&&id===requestID&&current===record)show(record,record.lastEntry,record.lastOptions);}).catch(e=>{if(id===requestID)ui.status('资料库暂不可用，阅读功能继续：'+e.message);});}
    const entry=record.fromLibrary?record.savedEntry:basic(record.info);
    show(record,entry,{pin});
    if(!config.aiEnabled || (entry&&!forceAI))return;
    show(record,entry,{pin,state:'loading'});
    try{
      const context=config.sendContext?record.context||'':'';
      const result=await ai.lookup(record.info,context,forceAI,signal);
      if(id!==requestID||version!==generation||current!==record)return;
      if(record.info.lang==='ja'&&KATAKANA.test(record.info.word.normalize('NFKC')))applyOriginal(record.info.word,result);
      show(record,result,{pin});
    }catch(error){if(error.name!=='AbortError'&&id===requestID&&current===record)show(record,entry,{state:'error',error:error.message,pin,extraAction:['重试',()=>activate(record,pin,true)]});}
  }
  async function queryPoint(point){
    const snapshot=captureAround(point.node,point.offset);if(!snapshot)return;
    const candidates=candidatesAt(snapshot,config.mode,tokenizer);if(!candidates.length)return;
    const info={...candidates[0],inferredOriginal:safeOriginal(originals.get(candidates[0].word),candidates[0].word)},record={snapshot,info,candidates,anchor:anchorFor(snapshot,info,point.node.parentElement),context:sentenceAt(snapshot.text,snapshot.target),note:tokenizerError?'注音词典不可用，使用本地候选；可调整选词范围。':''};
    // The card is visible immediately even when the full Japanese analyzer is unavailable.
    if(info.lang!=='ja'||tokenizer||tokenizerError||info.type==='grammar'||basic(info)){activate(record);return;}
    const id=++requestID,version=generation;current=record;show(record,basic(info),{state:'loading',analysisNote:'正在加载日语分析；已有候选可调整或查询。'});
    try{
      const ready=await Promise.race([ensureTokenizer(),new Promise(resolve=>setTimeout(()=>resolve(null),1000))]);
      if(id!==requestID||generation!==version||current!==record)return;
      if(ready){const refined=candidatesAt(snapshot,config.mode,ready);if(refined.length){record.info=refined[0];record.candidates=refined;record.anchor=anchorFor(snapshot,refined[0],record.anchor);}}
      else record.note='完整词典仍在加载，当前为浏览器分词候选。';
    }catch{record.note='注音词典加载失败，当前为浏览器分词候选。';}
    if(id===requestID&&generation===version&&current===record)activate(record);
  }
  function manualQuery(raw,record=current){
    const word=raw.trim();if(!word||!record)return;
    if(word.length>500){show(record,basic(record.info),{error:'一次最多查询 500 字符，请缩小划词范围。'});return;}
    const lang=KANA.test(word)||HAN.test(word)?'ja':'en';
    const matched=record.snapshot?candidatesAt(record.snapshot,config.mode,tokenizer).find(c=>c.word===word):null;
    const info=matched||{word,normalized:normalizeMapped(word).text,base:normalizeMapped(word).text.toLowerCase(),lang,method:'用户指定范围'};
    const detached=record.fromLibrary&&word!==record.info.word?{fromLibrary:false,savedId:null,savedEntry:null,encounterKey:null}:{};
    activate({...record,...detached,info,candidates:[],manual:true},true);
  }

  // Auto-annotation is an independent, incremental consumer of the same text projection.
  function renderPiece(element,info,pieceStart,pieceEnd,original){
    const sourceWord=safeOriginal(original,info.word);
    const parts=info.type==='grammar'||info.suppressAnnotation?[{text:info.word}]:sourceWord?[{text:info.word,reading:sourceWord}]:rubyParts(info.word,safeReading(info.reading));
    element.replaceChildren();let offset=0;
    for(const part of parts){
      const start=offset,end=offset+part.text.length;offset=end;
      const left=Math.max(start,pieceStart),right=Math.min(end,pieceEnd);if(right<=left)continue;
      const text=part.text.slice(left-start,right-start);
      if(part.reading&&left===start){const ruby=document.createElement('ruby');const rt=document.createElement('rt');rt.dataset.yomiAnnotation='';rt.textContent=part.reading;rt.setAttribute('aria-hidden','true');const source=document.createTextNode(text);ruby.append(source,rt);element.append(ruby);annotationOverlay.attach(source,rt);}else element.append(document.createTextNode(text));
    }
  }
  function wrap(info,pieceStart,pieceEnd){
    const span=document.createElement('span');span.dataset.yomiToken=info.lang;
    const local=loans.get(info.word.normalize('NFKC')),inferred=originals.get(info.word);
    if(info.type==='grammar')span.dataset.yomiGrammar=info.grammarId;
    meta.set(span,{info,pieceStart,pieceEnd});annotated.add(span);wordCount++;
    renderPiece(span,info,pieceStart,pieceEnd,local||inferred);
    if(inferred&&!local){span.dataset.aiOriginal='';span.title='AI 推断原词 · 请核对';}
    if(!local&&!inferred&&KATAKANA.test(info.word.normalize('NFKC')))visibleObserver.observe(span);
    return span;
  }
  function applyOriginal(word,original){
    if(!config.siteEnabled||!config.annotationEnabled||!safeOriginal(original,word))return;originals.set(word,original);
    annotationOverlay.update(word,original);
    for(const element of annotated){if(!element.isConnected){annotated.delete(element);continue;}const {info,pieceStart,pieceEnd}=meta.get(element);if(info.word===word&&!info.suppressAnnotation&&pieceStart===0&&pieceEnd===word.length){let rt=element.querySelector('rt');if(!rt){rt=document.createElement('rt');rt.dataset.yomiAnnotation='';rt.setAttribute('aria-hidden','true');element.style.setProperty('position','relative','important');element.append(rt);}rt.textContent=safeOriginal(original,word);if(element.firstChild?.nodeType===3)annotationOverlay.attach(element.firstChild,rt);annotationOverlay.refresh();element.dataset.aiOriginal='';}}
  }
  const visibleObserver=new IntersectionObserver(entries=>{for(const entry of entries){const data=meta.get(entry.target);if(entry.isIntersecting&&config.aiEnabled&&config.autoOriginals&&data&&!autoTried.has(data.info.word))autoPending.add(data.info.word);}scheduleOriginals();},{rootMargin:'200px'});
  function scheduleOriginals(){
    if(!config.siteEnabled||!config.annotationEnabled||!config.aiEnabled||!config.autoOriginals||autoBusy||!autoPending.size||autoCount>=60)return;
    clearTimeout(autoTimer);autoTimer=setTimeout(async()=>{
      if(!config.siteEnabled||!config.annotationEnabled||!config.aiEnabled||!config.autoOriginals)return;
      const words=[...autoPending].filter(w=>!autoTried.has(w)).slice(0,Math.min(12,60-autoCount));if(!words.length)return;
      for(const word of words){autoPending.delete(word);autoTried.add(word);}autoCount+=words.length;autoBusy=true;const version=generation;
      try{const result=await ai.originals(words);if(generation===version)for(const [word,value]of Object.entries(result))applyOriginal(word,value);}
      catch(error){ui.status(`原词补全暂停：${error.message}`);autoCount=60;autoPending.clear();}
      finally{autoBusy=false;scheduleOriginals();}
    },700);
  }
  function skipAnnotation(node){return !node?.isConnected||excluded(node.parentElement)||annotationOverlay.has(node)||!!node.parentElement.closest('ruby,[data-yomi-token]');}
  function selectionTouches(node){const s=getSelection();if(pointerDown)return true;if(!s||s.isCollapsed||!s.rangeCount)return false;try{return s.getRangeAt(0).intersectsNode(node);}catch{return false;}}
  async function annotateNode(node,version){
    if(skipAnnotation(node)||!node.nodeValue.trim()||node.length>5000||wordCount>=30000)return;
    if(selectionTouches(node)){deferredNodes.add(node);return;}
    const original=node.nodeValue,snapshot=captureAround(node,Math.floor(node.length/2),Math.min(3000,node.length+300));if(!snapshot)return;
    const jp=config.mode!=='en'&&(config.mode==='ja'||snapshot.lang.startsWith('ja')||KANA.test(snapshot.text));
    if(!jp)return;
    let engine=tokenizer;
    if(HAN.test(snapshot.text)&&!tokenizerError){try{engine=await ensureTokenizer();}catch{/* Native query path remains independent. */}}
    if(generation!==version||node.nodeValue!==original||skipAnnotation(node))return;
    if(selectionTouches(node)){deferredNodes.add(node);return;}
    const projection=snapshot.segments.find(s=>s.node===node);if(!projection)return;
    const mapped=normalizeMapped(snapshot.text),grammar=grammarMatches(mapped.text,engine).map(g=>({...g,start:mapped.starts[g.start],end:mapped.ends[g.end-1]}));
    const vocabulary=analyze(snapshot,config.mode,engine).filter(t=>!grammar.some(g=>t.start<g.end&&t.end>g.start));
    const suppressAnnotation=!hasAnnotationRoom(node);
    const intervals=[...grammar,...vocabulary].sort((a,b)=>a.start-b.start).filter(info=>info.lang==='ja'&&info.start<projection.end&&info.end>projection.start&&(info.type==='grammar'||HAN.test(info.word)&&info.reading||KATAKANA.test(info.word.normalize('NFKC')))).map(info=>({...info,suppressAnnotation}));
    if(!intervals.length)return;
    if(suppressAnnotation||node.parentElement.closest('button,[role="button"]')){
      annotationOverlay.add(node,snapshot,intervals.filter(info=>info.start>=projection.start),word=>loans.get(word.normalize('NFKC'))||originals.get(word));
      wordCount+=intervals.length;
      for(const info of intervals)if(KATAKANA.test(info.word.normalize('NFKC'))&&!loans.has(info.word.normalize('NFKC'))&&!originals.get(info.word)){const b=node.parentElement.getBoundingClientRect();if(b.bottom>0&&b.top<innerHeight)autoPending.add(info.word);}
      scheduleOriginals();return;
    }
    const fragment=document.createDocumentFragment();let cursor=0;
    for(const info of intervals){
      const left=Math.max(info.start,projection.start),right=Math.min(info.end,projection.end);
      const nodeLeft=projection.nodeStart+left-projection.start,nodeRight=projection.nodeStart+right-projection.start;
      if(nodeLeft<cursor)continue;
      fragment.append(document.createTextNode(original.slice(cursor,nodeLeft)),wrap(info,left-info.start,right-info.start));cursor=nodeRight;
    }
    fragment.append(document.createTextNode(original.slice(cursor)));
    if(generation===version&&node.nodeValue===original&&node.isConnected)node.replaceWith(fragment);
  }
  function enqueue(root){
    if(!config.siteEnabled||!config.annotationEnabled||!root?.isConnected||excluded(root.nodeType===3?root.parentElement:root))return;
    if((root.nodeType===3?root.parentElement:root).closest('ruby,[data-yomi-token]'))return;
    pendingRoots.add(root);if(scheduled||processing)return;scheduled=true;setTimeout(drain,70);
  }
  async function drain(){
    scheduled=false;if(processing)return;processing=true;const version=generation;
    try{
      let processed=0;
      while(pendingRoots.size&&version===generation&&config.siteEnabled&&config.annotationEnabled){
        const roots=[...pendingRoots];pendingRoots.clear();
        for(const root of roots.filter(r=>!roots.some(other=>other!==r&&other.contains(r)))){
          if(!root.isConnected)continue;
          const nodes=[];
          if(root.nodeType===3)nodes.push(root);
          else{const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode(n){if(n.nodeType===1)return excluded(n)||n.matches('ruby,[data-yomi-token]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_SKIP;return n.nodeValue.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;}});while(walker.nextNode())nodes.push(walker.currentNode);}
          for(const node of nodes){if(generation!==version||wordCount>=30000)break;await annotateNode(node,version);if(++processed%10===0)await new Promise(r=>setTimeout(r,0));}
        }
      }
      for(const node of annotated)if(!node.isConnected){annotated.delete(node);visibleObserver.unobserve(node);}
      if(version===generation&&!tokenizerError)ui.status(wordCount>=30000?'自动注音已达到上限 · 悬浮与划词仍可查询':`注音 ${annotated.size} 处 · 悬浮与划词查询就绪`);
    }catch(error){ui.status(`注音处理异常，查询入口仍可用：${error.message}`);}
    finally{processing=false;if(pendingRoots.size){scheduled=true;setTimeout(drain,70);}}
  }
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='characterData'||record.type==='attributes')enqueue(record.target);
      else for(const node of record.addedNodes)if(node.nodeType===1||node.nodeType===3)enqueue(node);
    }
  });
  function reset(){
    generation++;observer.disconnect();visibleObserver.disconnect();pendingRoots.clear();deferredNodes.clear();autoPending.clear();clearTimeout(autoTimer);ui.closeTip();ui.hideSelection();
    annotationOverlay.clear();
    for(const element of annotated){if(!element.isConnected)continue;element.querySelectorAll('rt,rp').forEach(n=>n.remove());element.replaceWith(document.createTextNode(element.textContent));}
    annotated.clear();wordCount=0;ui.setEnabled(config.siteEnabled);
    if(config.siteEnabled&&config.annotationEnabled){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['lang','hidden','aria-hidden','contenteditable']});enqueue(document.body);}
  }

  let nodeID=0;const nodeIDs=new WeakMap();
  function pointer(event){
    if(!config.siteEnabled||pointerDown||ui.isPinned()||ui.isSettingsOpen()||!getSelection()?.isCollapsed)return;
    if(ui.contains(event.target)){clearTimeout(hideTimer);return;}
    lastPoint={x:event.clientX,y:event.clientY};
    const point=pointText(lastPoint.x,lastPoint.y);
    if(!point){clearTimeout(hoverTimer);highlights.set('hover');hoverKey='';scheduleHide();return;}
    const snapshot=captureAround(point.node,point.offset);if(!snapshot)return;
    const candidate=candidatesAt(snapshot,config.mode,tokenizer)[0];
    if(!candidate){clearTimeout(hoverTimer);scheduleHide();return;}
    highlights.set('hover',snapshot,candidate);
    if(!nodeIDs.has(point.node))nodeIDs.set(point.node,++nodeID);
    const key=`${nodeIDs.get(point.node)}:${candidate.word}:${candidate.start}:${candidate.base}`;
    clearTimeout(hideTimer);if(key===hoverKey)return;
    hoverKey=key;clearTimeout(hoverTimer);requestID++;queryController?.abort();
    hoverTimer=setTimeout(()=>{if(point.node.isConnected&&!pointerDown)queryPoint(point);},basic(candidate)?25:config.hoverDelay);
  }
  // Pointer movement detects different words within one unmodified Text node.
  let pointerFrame=0,latestPointer;
  function schedulePointer(event){latestPointer={target:event.target,clientX:event.clientX,clientY:event.clientY};if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;pointer(latestPointer);});}
  document.addEventListener('pointermove',schedulePointer,{passive:true});
  document.addEventListener('pointerover',schedulePointer,{passive:true});
  document.addEventListener('pointerout',event=>{if(event.relatedTarget===null){clearTimeout(hoverTimer);scheduleHide();}},{passive:true});
  document.addEventListener('pointerdown',event=>{if(ui.contains(event.target))return;pointerDown=true;clearTimeout(hoverTimer);ui.hideSelection();if(!pointText(event.clientX,event.clientY))ui.closeTip();},{passive:true});
  document.addEventListener('pointerup',event=>{
    pointerDown=false;if(ui.contains(event.target))return;
    if(getSelection()?.isCollapsed){for(const node of deferredNodes)enqueue(node);deferredNodes.clear();}
    setTimeout(()=>{
      if(!config.siteEnabled)return;
      const selection=getSelection();if(selection?.isCollapsed){if(event.pointerType==='touch'&&!event.target.closest('a')){const point=pointText(event.clientX,event.clientY);if(point)queryPoint(point);}return;}
      offerSelection();
    },0);
  },{passive:true});
  function offerSelection(direct=false){
    if(!config.siteEnabled)return;const selection=getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return;
    const range=selection.getRangeAt(0).cloneRange();const start=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer;
    if(excluded(start)||start.getRootNode()!==document)return;
    const text=selectedText(range);if(!text)return;
    const snapshot=range.startContainer.nodeType===3?captureAround(range.startContainer,range.startOffset):null;
    const rect=range.getBoundingClientRect();const record={snapshot,anchor:()=>range.getBoundingClientRect(),context:snapshot?sentenceAt(snapshot.text,snapshot.target):text,candidates:[],info:{word:text,base:text,lang:KANA.test(text)||HAN.test(text)?'ja':'en',method:'用户划词'}};
    const query=()=>{if(text.length>500){current=record;show(record,null,{error:'已选择超过 500 字符，请缩小范围后重新查询。',pin:true});return;}manualQuery(text,record);};
    if(direct)query();else ui.selection(rect,query);
  }
  document.addEventListener('keyup',event=>{if(event.altKey&&event.key.toLowerCase()==='y')offerSelection(true);else if(event.key==='Shift')offerSelection();});
  document.addEventListener('selectionchange',()=>{if(getSelection()?.isCollapsed&&!pointerDown){ui.hideSelection();for(const node of deferredNodes)enqueue(node);deferredNodes.clear();}});
  document.addEventListener('copy',event=>{
    if(event.defaultPrevented||ui.contains(event.target))return;
    const selection=getSelection();if(!selection?.rangeCount)return;const range=selection.getRangeAt(0);const copy=range.cloneContents();
    if(!copy.querySelector('[data-yomi-token],[data-yomi-annotation]'))return;
    copy.querySelectorAll('[data-yomi-annotation],[data-yomi-token] rt,[data-yomi-token] rp').forEach(n=>n.remove());
    event.clipboardData?.setData('text/plain',copy.textContent);const div=document.createElement('div');div.append(copy);event.clipboardData?.setData('text/html',div.innerHTML);if(event.clipboardData)event.preventDefault();
  });
  GM_registerMenuCommand('Yomi：设置 / AI 接口',()=>ui.openSettings());
  GM_registerMenuCommand('Yomi：Library / 间隔复习',()=>ui.openLibrary());
  GM_registerMenuCommand('Yomi：查询已选文字（Alt+Y）',()=>offerSelection(true));
  GM_registerMenuCommand('Yomi：启用 / 暂停当前站点',()=>{config.siteEnabled=!config.siteEnabled;GM_setValue(siteKey,{siteEnabled:config.siteEnabled,mode:config.mode});reset();});
  GM_registerMenuCommand('Yomi：重新扫描页面',()=>{tokenizerError='';reset();});
  setStyle();reset();
})();
