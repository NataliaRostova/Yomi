import {renderPronunciation,annotateCardWord} from './pronunciation.js';
import {safeReading} from './annotation.js';
import { renderKnowledge } from './knowledge-view.js';
import { makeDraggable, clampPanel, viewBounds } from './drag.js';

// A separate query session: drilling into an example never replaces the page card.
// All offsets come from the shared language analyzer; only owned UI text is wrapped.
export function createExampleExplorer(shadow,parent,callbacks) {
  const panel=document.createElement('section');panel.className='panel example-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','例句子词卡');
  panel.innerHTML=`<div class="bar"><span class="eyebrow">EXAMPLE / 例句探索</span><div class="tools"><button class="icon child-back" aria-label="返回上一级">← 返回</button><button class="icon child-close" aria-label="关闭子词卡">×</button></div></div><div class="child-scroll"><div class="child-path note"></div><div class="child-word"></div><div class="child-meta metadata"></div><div class="child-pronunciation pronunciation"></div><div class="child-state state-line" role="status"></div><div class="child-meaning"></div><div class="child-error error"></div><div class="child-context note"></div><details class="child-details"><summary>用法 · 例句 ＋</summary><div class="child-usage usage"></div><div class="child-knowledge"></div></details><details class="child-adjust"><summary>调整选词范围</summary><input class="child-query" maxlength="500" aria-label="子词卡查询文本"><button class="action child-apply">查询 ↗</button></details></div><div class="tip-footer"><div class="child-source source"></div><div class="actions"><button class="action child-ai">AI 解释 ↗</button><button class="action child-collect">＋ 收录</button></div></div>`;
  shadow.querySelector('.surface').append(panel);
  const $=s=>panel.querySelector(s),put=(s,text)=>$(s).textContent=text||'';
  let stack=[],controller,serial=0,timer,activeToken,hovered,placed=false;
  const top=()=>stack.at(-1),reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
  const drag=makeDraggable(panel,$('.bar'),()=>{placed=true;});
  function position(){if(panel.hidden||drag.isDragging())return;if(drag.hasGeometry()){drag.reflow();return;}const v=viewBounds();panel.style.maxWidth=`${v.width}px`;panel.style.maxHeight=`${v.height}px`;const b=parent.getBoundingClientRect();let x=placed?parseFloat(panel.style.left):b.left-panel.offsetWidth-12,y=placed?parseFloat(panel.style.top):b.top+24;if(!placed&&x<v.left+12)x=b.right+12;if(!placed&&x+panel.offsetWidth>v.left+v.width-12){x=v.left+24;y=b.top+48;}const p=clampPanel(panel,x,y);panel.style.left=`${p.x}px`;panel.style.top=`${p.y}px`;placed=true;}
  function cancel(){clearTimeout(timer);controller?.abort();serial++;}
  function close(){cancel();drag.cancel();panel.hidden=true;stack=[];placed=false;hovered=null;activeToken?.classList.remove('example-active');activeToken=null;}
  function render(){const record=top();if(!record)return;const {info,entry,error,loading}=record;panel.hidden=false;drag.raise();panel.dataset.state=loading?'loading':error?'error':entry?'success':'empty';
    put('.child-word',info.word);annotateCardWord($('.child-word'),info,entry);renderPronunciation($('.child-pronunciation'),info,entry);put('.child-meta',[info.type==='grammar'?`GRAMMAR / ${entry?.jlptLevel||''}`:info.lang==='ja'?'JA → ZH':'EN → ZH',info.reading||entry?.reading,entry?.original,info.base!==info.word?info.base:'',entry?.pos].filter(Boolean).join(' · '));
    put('.child-path',[parent.querySelector('.word').textContent,...stack.slice(0,-1).map(r=>r.info.word)].join(' → '));$('.child-back').disabled=stack.length<2;
    put('.child-state',loading?'ANALYZING / 查询中':error?'REQUEST ERROR / 请求失败':entry?'EXAMPLE LOOKUP / 例句查询':'NO ENTRY / 未找到词条');put('.child-meaning',entry?.meaning||(loading?`正在解析「${info.word}」…`:'未找到本地词条'));put('.child-error',error);
    put('.child-context',`当前查询出处（上一级文本）：${record.context}`);put('.child-usage',[entry?.grammarConnection,entry?.usage,entry?.explanation].filter(Boolean).join('\n'));renderKnowledge($('.child-knowledge'),entry,decorate,{child:true});put('.child-source',entry?.source||'可调整范围，或请求 AI 解释。');$('.child-query').value=info.word;
    $('.child-collect').hidden=!entry;$('.child-collect').disabled=false;put('.child-collect',callbacks.repository.find(info)?'✓ 已收录':'＋ 收录');position();
  }
  async function load(record,force=false){cancel();controller=new AbortController();const id=serial;record.entry=record.entry||callbacks.exampleBasic(record.info);record.error='';record.loading=!record.entry||force;render();
    try{const entry=await callbacks.exampleLookup(record.info,record.context,controller.signal,force);if(id!==serial||record!==top())return;record.entry=entry;record.loading=false;render();}catch(error){if(error.name==='AbortError'||id!==serial||record!==top())return;record.loading=false;record.error=error.message;render();}
  }
  function open(info,context,token,child){if(top()?.info.word===info.word&&top()?.context===context&&!panel.hidden)return;const opening=panel.hidden;activeToken?.classList.remove('example-active');activeToken=token;token?.classList.add('example-active');const record={info:{...info,reading:info.reading||callbacks.cardReading?.(info.word)||''},context};stack=child?[...stack.slice(-11),record]:[record];$('.child-details').open=false;$('.child-adjust').open=false;$('.child-scroll').scrollTop=0;load(record);if(!reduced())(opening?panel:$('.child-scroll')).animate([{opacity:.3},{opacity:1}],{duration:opening?200:100,easing:'ease-out'});}
  function decorate(container,text){if(container.dataset.exampleText===text)return;if(/[\p{Script=Han}]/u.test(text)&&!callbacks.readingsReady?.())callbacks.prepareReadings?.(text).then(ready=>{if(ready&&container.isConnected&&container.dataset.exampleText===text){container.dataset.exampleText='';decorate(container,text);}}).catch(()=>{});container.dataset.exampleText=text;container.replaceChildren();container.hidden=!text;container.title='悬停或点击词语继续查询；可选择并复制例句';
    const grammars=callbacks.exampleGrammar?.(text)||[];
    let cursor=0;for(let offset=0;offset<text.length;){if(!/[\p{L}\p{M}]/u.test(text[offset])){offset++;continue;}let info=grammars.find(g=>offset>=g.start&&offset<g.end)||callbacks.exampleCandidates(text,offset)[0];if(!info||info.start<cursor||info.end<=offset){offset++;continue;}
      // A conjugated verb can overlap the start of a grammar pattern. Reserve that
      // range before wrapping the prefix, so the complete grammar remains queryable.
      const boundary=grammars.find(g=>g.start>info.start&&g.start<info.end);if(boundary){const word=text.slice(info.start,boundary.start);info={...info,word,base:word,end:boundary.start,reading:callbacks.cardReading?.(word)||''};}
      container.append(document.createTextNode(text.slice(cursor,info.start)));const token=document.createElement('span');token.className='example-token';token.tabIndex=0;token.setAttribute('role','button');token.setAttribute('aria-label',`查询 ${info.word}`);token.textContent=text.slice(info.start,info.end);if(info.lang==='ja'&&/[\p{Script=Han}]/u.test(info.word)){const reading=safeReading(info.reading)||safeReading(callbacks.cardReading?.(info.word));if(reading)token.dataset.kana=reading;}
      const child=container.closest('.example-panel')===panel,enter=()=>{clearTimeout(timer);hovered=token;timer=setTimeout(()=>{if(hovered===token&&!selectionText())open(info,text,token,child);},220);};
      token.addEventListener('pointerenter',enter);token.addEventListener('pointerleave',()=>{if(hovered===token){hovered=null;clearTimeout(timer);}});token.addEventListener('click',()=>{if(!selectionText())open(info,text,token,child);});token.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(info,text,token,child);}});container.append(token);cursor=info.end;offset=info.end;
    }container.append(document.createTextNode(text.slice(cursor)));
  }
  function selectionText(){return (shadow.getSelection?.()||getSelection())?.toString()||'';}
  function back(){if(stack.length<2)return;cancel();stack.pop();activeToken?.classList.remove('example-active');activeToken=null;render();if(!top().entry)load(top());}
  $('.child-close').onclick=close;$('.child-back').onclick=back;$('.child-ai').onclick=()=>top()&&load(top(),true);
  $('.child-collect').onclick=async()=>{const record=top();if(!record?.entry)return;$('.child-collect').disabled=true;try{await callbacks.exampleCollect(record.info,record.entry,record.context);if(record===top())render();}catch(error){if(record===top()){record.error='资料库保存失败：'+error.message;render();}}};
  const manual=()=>{const word=$('.child-query').value.trim();if(!word||!top())return;const candidates=callbacks.exampleCandidates(word,0);const info=candidates.find(c=>c.word===word)||{word,base:word.normalize('NFKC').toLowerCase(),lang:/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(word)?'ja':'en',method:'例句 · 用户指定范围'};open(info,top().context,null,true);};$('.child-apply').onclick=manual;$('.child-query').onkeydown=e=>{if(e.key==='Enter')manual();};
  panel.addEventListener('pointerenter',callbacks.onEnterTip);new ResizeObserver(position).observe(panel);
  return {decorate,close,position,isOpen:()=>!panel.hidden};
}
