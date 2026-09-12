import {renderPronunciation,annotateCardWord} from './pronunciation.js';
import { createCollectionPicker } from './collection-picker.js';
import { renderKnowledge } from './knowledge-view.js';
import { CSS } from './ui-styles.js';
import { createLearningUI, STATE_LABELS } from './learning-ui.js';
import { makeDraggable } from './drag.js';
import { createExampleExplorer } from './example-explorer.js';
export function createUI(callbacks) {
  const host=document.createElement('div');host.dataset.yomiUi='';host.dataset.yomiRoot='';
  host.style.cssText='all:initial!important;position:fixed!important;z-index:2147483647!important;top:0!important;left:0!important;width:0!important;height:0!important;';
  const shadow=host.attachShadow({mode:'closed'});
  shadow.innerHTML=`<style>${CSS}</style><div class="surface">
  <button class="launcher" aria-label="打开 Yomi 设置"><span>YOMI / 03</span><i class="signal"></i></button>
  <button class="library-launch action" aria-label="打开学习资料库">Library / 资料库 ↗</button>
  <button class="selection-action" hidden>查询所选文本 ↗</button>
  <section class="panel tooltip" hidden role="dialog" aria-label="词语释义" aria-live="polite">
    <div class="bar"><span class="eyebrow">YOMI / LEXICAL ANALYSIS</span><div class="tools"><button class="icon pin" aria-label="固定词卡" aria-pressed="false">固定</button><button class="icon close" aria-label="关闭释义">×</button></div></div>
    <div class="tip-scroll"><div class="title-line"><div class="word"></div><span class="badge language"></span></div>
      <div class="metadata"><span class="reading"></span><span class="pos"></span></div><div class="pronunciation"></div>
      <div class="state-line"><span class="status-code"></span></div><div class="meaning"></div><div class="context-note"></div><section class="source-context"><div class="label">CONTEXT / 网页原文</div><div class="source-sentence"></div><div class="context-meaning note"></div><a class="context-origin note" target="_blank" rel="noopener noreferrer"></a></section>
      <details class="details"><summary>词形 · 用法 · 例句 ＋</summary><div class="detail-body"><div class="label">FORM / 词形</div><div class="morphology"></div><div class="label">USAGE / 用法与搭配</div><div class="usage"></div><div class="collocations"></div><div class="knowledge-content"></div></div></details>
      <div class="analysis-note"></div><div class="error"></div>
      <details class="adjust"><summary>调整选词范围</summary><label class="field">查询文本 <span class="field-id">MAX 500</span><input class="query-text" maxlength="500" autocomplete="off"></label><div class="candidate-list"></div><button class="action query-apply" style="margin-top:10px">按此范围查询 ↗</button><div class="note">可输入单词、短语或句子，也可直接在网页上划词。</div></details>
    </div><div class="tip-footer"><div class="learning-status"></div><div class="source"></div><div class="actions"></div></div>
  </section>
  <section class="panel settings" hidden role="dialog" aria-label="Yomi 设置">
    <div class="bar"><span class="eyebrow">YOMI / SYSTEM PREFERENCES</span><button class="icon close" aria-label="关闭设置">×</button></div>
    <div class="settings-heading"><h2>阅读终端<span>READER SETTINGS</span></h2><div class="subline mono">VERSION 03.07　/　LOCAL FIRST</div>
    <div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="true" data-tab="reading"><b>01</b>阅读与界面</button><button class="tab" role="tab" aria-selected="false" data-tab="ai"><b>02</b>AI 服务</button></div></div>
    <div class="settings-scroll"><div class="tab-content" data-content="reading">
      <label class="setting-row"><span><strong>当前站点启用</strong><small>注音、悬浮查询与划词入口</small></span><input class="switch" name="siteEnabled" type="checkbox"></label>
      <label class="setting-row"><span><strong>自动注音</strong><small>关闭后仍可悬浮查询普通文本</small></span><input class="switch" name="annotationEnabled" type="checkbox"></label>
      <div class="row"><label class="field">文本语言<select name="mode"><option value="auto">自动识别日语与英语</option><option value="ja">日语（含纯汉字）</option><option value="en">仅处理英语</option></select></label><label class="field">界面主题<select name="theme"><option value="auto">跟随系统</option><option value="light">浅色 / PAPER</option><option value="dark">深色 / GRAPHITE</option></select></label></div>
      <div class="row"><label class="field">注音字号 <output class="value" data-output="rubySize"></output><input name="rubySize" type="range" min="0.35" max="0.85" step="0.05"></label><label class="field">注音透明度 <output class="value" data-output="rubyOpacity"></output><input name="rubyOpacity" type="range" min="0.2" max="1" step="0.05"></label></div>
      <label class="field">悬浮等待 <output class="value" data-output="hoverDelay"></output><input name="hoverDelay" type="range" min="150" max="700" step="50"></label>
      <div class="note notice-line">鼠标停留即可查询，移入词卡继续阅读。固定后可自由移动鼠标，按 Esc 关闭。选择网页文字后可查询短语或句子。</div>
    </div><div class="tab-content" data-content="ai" hidden>
      <label class="setting-row"><span><strong>启用 AI 解释</strong><small>生词按需查询，基础词库始终可用</small></span><input class="switch" name="aiEnabled" type="checkbox"></label>
      <label class="field">API 地址 <span class="field-id">CHAT COMPLETIONS</span><input name="endpoint" type="url" placeholder="https://your-provider.example/v1/chat/completions" spellcheck="false" autocomplete="off"></label>
      <div class="row"><label class="field">API Key<input name="apiKey" type="password" placeholder="本机无认证服务可留空" autocomplete="off"></label><label class="field">模型 ID<input name="model" type="text" placeholder="服务商提供的模型名" spellcheck="false" autocomplete="off"></label></div>
      <label class="field">接口兼容<select name="aiCompatibility"><option value="auto">自动识别（含 DeepSeek Flash / Pro）</option><option value="deepseek">DeepSeek · 非思考 + JSON 输出</option><option value="generic">通用 Chat Completions</option></select><span class="note">DeepSeek 适配关闭思考以快速获取释义；中转接口不支持这些参数时可选择「通用」。</span></label>
      <label class="check"><span>附带附近原文 <span class="field-id">≤ 240 字符</span></span><input class="switch" name="sendContext" type="checkbox"></label>
      <label class="check"><span>自动补全未知片假名原词 <span class="field-id">≤ 60 词 / 页</span></span><input class="switch" name="autoOriginals" type="checkbox"></label>
      <div class="note notice-line">默认不发送整页。启用后，悬浮生词会发送该词；原文与批量原词补全分别由上方开关控制，可能产生费用。AI 读音、词源及释义会标明推断来源。</div>
      <div class="actions"><button class="action test">测试 AI 连接 ↗</button><button class="action clear">清理缓存</button></div>
    </div></div>
    <div class="settings-bottom"><div class="error"></div><div class="status" role="status"></div><div class="actions"><button class="action primary save">保存并应用 ↗</button><button class="action rescan">重新扫描</button></div></div>
  </section></div>`;
  document.documentElement.append(host);
  const $=s=>shadow.querySelector(s),tip=$('.tooltip'),settings=$('.settings');
  let anchor,pinned=false,activeKey='',selectionCallback,returnFocus,closingTimer,animation,positioned=false;
  const drag=makeDraggable(tip,tip.querySelector('.bar'),()=>{positioned=true;});
  const settingsWindow=makeDraggable(settings,settings.querySelector('.bar'));
  const explorer=createExampleExplorer(shadow,tip,callbacks);
  const collection=createCollectionPicker(shadow,callbacks.repository);
  const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
  const put=(s,value='')=>$(s).textContent=value||'';
  const viewport=()=>({left:window.visualViewport?.offsetLeft||0,top:window.visualViewport?.offsetTop||0,width:window.visualViewport?.width||innerWidth,height:window.visualViewport?.height||innerHeight});
  function layout(){
    // The overlay is outside body. Neutralize html's CSS zoom, but retain real browser zoom.
    const rootZoom=parseFloat(getComputedStyle(document.documentElement).zoom)||1;
    host.style.setProperty('zoom',String(1/rootZoom),'important');
    const v=viewport(),launcher=$('.launcher');
    launcher.style.right='auto';launcher.style.bottom='auto';launcher.style.left=`${v.left+v.width-launcher.offsetWidth-16}px`;launcher.style.top=`${v.top+v.height-launcher.offsetHeight-20}px`;
    const libraryButton=$('.library-launch');libraryButton.style.left=`${v.left+v.width-libraryButton.offsetWidth-16}px`;libraryButton.style.top=`${v.top+v.height-launcher.offsetHeight-libraryButton.offsetHeight-30}px`;
    if(!settings.hidden){
      if(settingsWindow.isDragging())return;
      if(settingsWindow.hasGeometry()){settingsWindow.reflow();return;}
      settings.style.maxWidth=`${v.width}px`;settings.style.maxHeight=`${v.height}px`;settings.style.right='auto';settings.style.bottom='auto';
      settings.style.left=`${Math.max(v.left,v.left+v.width-settings.offsetWidth-24)}px`;settings.style.top=`${Math.max(v.top,v.top+v.height-settings.offsetHeight-76)}px`;
    }
  }
  function position() {
    layout();
    learning.position();
    explorer.position();
    if(tip.hidden || !anchor || drag.isDragging()) return;
    if(drag.hasGeometry()){drag.reflow();return;}
    const v=viewport(),b=typeof anchor==='function'?anchor():anchor.getBoundingClientRect?.();if(!b) return;
    tip.style.maxWidth=`${v.width}px`;tip.style.maxHeight=`${v.height}px`;
    const w=tip.offsetWidth,h=tip.offsetHeight;let x=positioned?parseFloat(tip.style.left):v.left+v.width-w-24;if(!positioned&&b.right>x-12)x=b.left-w-12;
    tip.style.left=`${Math.max(v.left+12,Math.min(x,v.left+v.width-w-12))}px`;
    tip.style.top=`${Math.max(v.top,Math.min(positioned?parseFloat(tip.style.top):b.top-14,v.top+v.height-h))}px`;positioned=true;
  }
  function setPinned(value){pinned=value;$('.pin').setAttribute('aria-pressed',String(value));put('.pin',value?'已固定':'固定');}
  function closeTip(force=true){if(pinned&&!force)return;explorer.close();drag.cancel();if(tip.hidden||tip.dataset.closing==='true'){callbacks.onCloseTip();return;}clearTimeout(closingTimer);animation?.cancel();tip.dataset.closing='true';tip.style.pointerEvents='none';if(!reduced())animation=tip.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(24px)'}],{duration:180,easing:'ease-out',fill:'forwards'});closingTimer=setTimeout(()=>{tip.hidden=true;tip.dataset.closing='false';animation?.cancel();anchor=null;positioned=false;},reduced()?0:180);setPinned(false);callbacks.onCloseTip();}
  function closeSettings(){settingsWindow.cancel();settings.hidden=true;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
  function theme(){const choice=callbacks.getConfig().theme||'auto';$('.surface').dataset.theme=choice==='auto'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):choice;}
  function outputs(){for(const output of shadow.querySelectorAll('[data-output]')){const key=output.dataset.output;output.textContent=$(`[name=${key}]`).value+(key==='hoverDelay'?' ms':'');}}
  const form=()=>Object.fromEntries([...settings.querySelectorAll('[name]')].map(i=>[i.name,i.type==='checkbox'?i.checked:i.value]));
  async function run(button,fn){put('.settings .error');button.disabled=true;try{await fn(form());}catch(error){put('.settings .error',error.message);}finally{button.disabled=false;}}
  $('.save').onclick=event=>run(event.currentTarget,callbacks.onSave);$('.test').onclick=event=>run(event.currentTarget,callbacks.onTest);
  $('.clear').onclick=callbacks.onClear;$('.rescan').onclick=callbacks.onRescan;$('.launcher').onclick=()=>api.openSettings();$('.tooltip .close').onclick=()=>closeTip();$('.settings .close').onclick=closeSettings;$('.pin').onclick=()=>setPinned(!pinned);
  $('.query-apply').onclick=()=>callbacks.onManual($('.query-text').value);$('.query-text').addEventListener('keydown',e=>{if(e.key==='Enter')callbacks.onManual(e.target.value);});
  $('.selection-action').onpointerdown=e=>e.preventDefault();$('.selection-action').onclick=()=>{api.hideSelection();selectionCallback?.();};settings.addEventListener('input',outputs);
  for(const tab of shadow.querySelectorAll('[data-tab]'))tab.onclick=()=>{for(const t of shadow.querySelectorAll('[data-tab]'))t.setAttribute('aria-selected',String(t===tab));for(const content of shadow.querySelectorAll('[data-content]'))content.hidden=content.dataset.content!==tab.dataset.tab;};
  tip.addEventListener('pointerenter',callbacks.onEnterTip);tip.addEventListener('pointerleave',callbacks.onLeaveTip);
  const escape=e=>{if(e.key==='Escape'){if(collection.isOpen()){collection.close();return;}if(explorer.isOpen()){explorer.close();return;}closeTip();closeSettings();learning.close();api.hideSelection();}};
  shadow.addEventListener('keydown',e=>{escape(e);e.stopPropagation();});shadow.addEventListener('keyup',e=>e.stopPropagation());addEventListener('keydown',escape);
  addEventListener('scroll',()=>{if(pinned)position();else closeTip(false);api.hideSelection();},{passive:true});addEventListener('resize',position,{passive:true});window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
  new ResizeObserver(position).observe(tip);matchMedia('(prefers-color-scheme:dark)').addEventListener('change',theme);
  const api={
    isPinned:()=>pinned,isSettingsOpen:()=>!settings.hidden||learning.isOpen()||collection.isOpen(),contains:element=>element===host,closeTip,updateTheme:theme,openLibrary:()=>learning.open(),resumeLibrary:()=>learning.resume(),editSaved:id=>learning.editItem(id),
    collect:(info,entry,context,key)=>collection.open({info,entry,context,key}),
    hideSelection(){ $('.selection-action').hidden=true; },
    selection(rect,callback){selectionCallback=callback;const button=$('.selection-action');button.hidden=false;const v=viewport();button.style.left=`${Math.max(v.left+12,Math.min(rect.right,v.left+v.width-button.offsetWidth-12))}px`;button.style.top=`${Math.max(v.top+12,Math.min(rect.bottom+8,v.top+v.height-button.offsetHeight-12))}px`;},
    openSettings(){returnFocus=document.activeElement;closeTip();learning.close();api.hideSelection();const cfg=callbacks.getConfig();for(const input of settings.querySelectorAll('[name]')){if(input.type==='checkbox')input.checked=!!cfg[input.name];else input.value=cfg[input.name]??'';}outputs();settings.hidden=false;settingsWindow.raise();settings.querySelector('.close').focus();theme();layout();},
    status(value){put('.settings .status',value);$('.launcher').title=`Yomi · ${value}`;},setEnabled(enabled){put('.launcher span',enabled?'YOMI / 03':'YOMI / PAUSED');},
    show(target,info,entry,options={}){
      const opening=tip.hidden||tip.dataset.closing==='true';clearTimeout(closingTimer);tip.dataset.closing='false';tip.style.pointerEvents='';
      if(opening){drag.raise();positioned=false;anchor=target;animation?.cancel();tip.dataset.openCount=String(Number(tip.dataset.openCount||0)+1);}
      const key=`${info.word}|${info.base}`;if(key!==activeKey){explorer.close();$('.details').open=false;$('.adjust').open=false;$('.tip-scroll').scrollTop=0;if(!opening&&!reduced())$('.tip-scroll').animate([{opacity:.4},{opacity:1}],{duration:110,easing:'ease-out'});}activeKey=key;
      tip.hidden=false;const state=options.state||(options.loading?'loading':options.error?'error':entry?'success':'empty');tip.dataset.state=state;
      put('.word',info.word);annotateCardWord($('.word'),info,entry);renderPronunciation($('.pronunciation'),info,entry);put('.language',info.type==='grammar'?`GRAMMAR / ${entry?.jlptLevel||''}`:info.lang==='ja'?'JA → ZH':info.lang==='en'?'EN → ZH':'自定义');const ai=entry?.source?.includes('AI');
      put('.reading',[entry?.original?`${ai?'AI 原词推断 · ':''}${entry.original}`:info.inferredOriginal?`AI 原词推断 · ${info.inferredOriginal}`:'',info.base&&info.base!==info.word?`原形 ${info.base}`:''].filter(Boolean).join(' / '));put('.pos',entry?.pos||info.pos||'');
      put('.status-code',({loading:'ANALYZING / 查询中',empty:'NO LOCAL ENTRY / 未找到词条',error:'REQUEST ERROR / 请求失败',success:ai?'AI INFERENCE / 语境解释':'LOCAL MATCH / 基础释义'})[state]);
      put('.meaning',entry?.meaning||(state==='loading'?`正在解析「${info.word}」…`:'未找到本地词条'));put('.context-note',ai?'AI 推断结果，请结合原文核对。':info.type==='grammar'?`接续规则已匹配。等级为学习参考，语义请结合当前句核对。`:entry?'基础词典释义；当前语境中的词义尚未确认。':'查询入口可用。可调整范围，或请求 AI 解释。');
      put('.morphology',entry?.grammarConnection|| (info.base&&info.base!==info.word?`${info.word} → ${info.base}`:'原形 / 表面形式未发生变化'));put('.usage',[entry?.usage,entry?.explanation&&entry.explanation!==entry.usage?entry.explanation:'',entry?.domain?`领域：${entry.domain}`:'',entry?.sourceWord?`词源可信度：${Math.round((entry.sourceWordConfidence||0)*100)}% · ${entry.etymologyKind||'待核对'}`:''].filter(Boolean).join('\n')||'暂无用法记录。');put('.collocations',entry?.collocations||'');renderKnowledge($('.tooltip .knowledge-content'),entry,explorer.decorate);
      explorer.decorate($('.source-sentence'),options.context||'');$('.source-context').hidden=!options.context;put('.context-meaning',entry?.contextMeaning||'此处为网页原句；当前义项尚未确认。');
      put('.source-context .label',options.fromLibrary?'CONTEXT / 收录时原文':'CONTEXT / 网页原文');const origin=$('.context-origin');origin.removeAttribute('href');origin.textContent='';if(options.contextOrigin){try{const url=new URL(options.contextOrigin.url);if(['http:','https:'].includes(url.protocol)){origin.href=url.href;origin.textContent=options.contextOrigin.pageTitle||url.hostname;}}catch{}}if(options.expand)$('.details').open=true;
      const saved=options.saved;const names=saved?callbacks.repository.categoryIds(saved).map(id=>callbacks.repository.categoryList().find(c=>c.id===id)?.name).filter(Boolean):[];put('.learning-status',saved?`已收录 · 第 ${saved.encounterCount} 次遇见 · 已复习 ${saved.reviewCount} 次\n分类：${names.join(' / ')||'未分类'}\n${STATE_LABELS[saved.state]} · 下次 ${new Date(saved.nextReviewAt).toLocaleString('zh-CN')}\n首次收录 ${new Date(saved.createdAt).toLocaleDateString('zh-CN')}`:'');
      put('.analysis-note',[info.method,options.analysisNote].filter(Boolean).join(' · '));put('.tooltip .error',options.error);put('.source',entry?.source||'本地词库未命中 · 查询仍可继续');$('.query-text').value=info.word;
      const candidates=$('.candidate-list');candidates.replaceChildren();for(const candidate of options.candidates||[]){const b=document.createElement('button');b.textContent=candidate.word;b.onclick=()=>callbacks.onCandidate(candidate);candidates.append(b);}
      const actions=$('.tooltip .actions');actions.replaceChildren();for(const [label,callback] of options.actions||[]){const b=document.createElement('button');b.className='action'+(actions.children.length===0?' primary':'');b.textContent=label;b.onclick=callback;actions.append(b);}
      if(options.pin)setPinned(true);theme();position();if(opening&&!reduced()){const v=viewport(),distance=Math.max(0,Math.min(28,v.left+v.width-tip.getBoundingClientRect().right-2));animation=tip.animate([{opacity:0,transform:`translateX(${distance}px)`},{opacity:1,transform:'translateX(0)'}],{duration:220,easing:'cubic-bezier(.2,.75,.2,1)'});}
    },showAdjust(){ $('.adjust').open=true;$('.query-text').focus();position(); },
  };
  const learning=createLearningUI(shadow,callbacks.repository,()=>{closeTip();closeSettings();theme();layout();},collection,callbacks.onOpenSaved);$('.library-launch').onclick=()=>learning.open();
  theme();layout();return api;
}
