import {makeDraggable} from './drag.js';

export function categoryChecklist(container,repo,selected=[]) {
  container.replaceChildren();const set=new Set(selected);
  for(const category of repo.categoryList()){const label=document.createElement('label');label.className='category-choice';const input=document.createElement('input');input.type='checkbox';input.value=category.id;input.checked=set.has(category.id);const name=document.createElement('span');name.textContent=category.name;label.append(input,name);container.append(label);}
  if(!container.children.length){const text=document.createElement('p');text.className='note';text.textContent='还没有分类。可新建「韩语」「新闻」等分类，也可直接存入未分类。';container.append(text);}
}
export const selectedCategories=container=>[...container.querySelectorAll('input:checked')].map(e=>e.value);

export function createCollectionPicker(shadow,repo) {
  const panel=document.createElement('section');panel.className='panel collection-picker';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','收录到分类');
  panel.innerHTML=`<div class="bar"><span class="eyebrow">LIBRARY / FILE INTO</span><button class="icon close collection-close" aria-label="取消收录">×</button></div><div class="collection-body"><h2 class="collection-word"></h2><p class="note">选择一个或多个分类。同一份资料共享释义、上下文和复习进度。</p><div class="collection-choices"></div><div class="category-create"><input class="collection-name" maxlength="40" placeholder="新分类，如韩语 / 新闻" aria-label="新分类名称"><button class="action collection-create">＋ 新建</button></div><div class="collection-error error" role="status"></div></div><div class="collection-footer"><span class="collection-summary note"></span><div class="actions"><button class="action collection-cancel">取消</button><button class="action primary collection-save">确认收录</button></div></div>`;
  shadow.querySelector('.surface').append(panel);const $=s=>panel.querySelector(s),drag=makeDraggable(panel,$('.bar'));let request,resolve,previousFocus,busy=false,epoch=0;
  function position(){if(panel.hidden)return;if(drag.hasGeometry()){drag.reflow();return;}const v=visualViewport||{offsetLeft:0,offsetTop:0,width:innerWidth,height:innerHeight};panel.style.left=(v.offsetLeft+Math.max(0,(v.width-panel.offsetWidth)/2))+'px';panel.style.top=(v.offsetTop+Math.max(0,(v.height-panel.offsetHeight)/2))+'px';panel.style.maxWidth=v.width+'px';panel.style.maxHeight=v.height+'px';}
  function summary(){const count=selectedCategories($('.collection-choices')).length;$('.collection-summary').textContent=count?`已选 ${count} 个分类`:'未选择分类 · 保存到未分类';}
  function close(result=null){if(busy)return;epoch++;panel.hidden=true;request=null;const done=resolve;resolve=null;done?.(result);if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
  function disabled(value){busy=value;for(const e of panel.querySelectorAll('input,button'))e.disabled=value;}
  async function run(fn){disabled(true);$('.collection-error').textContent='';try{await fn();}catch(e){$('.collection-error').textContent=e.message;}finally{disabled(false);}}
  $('.collection-close').onclick=$('.collection-cancel').onclick=()=>close();$('.collection-choices').onchange=summary;
  $('.collection-create').onclick=()=>run(async()=>{const selected=selectedCategories($('.collection-choices')),category=await repo.createCategory($('.collection-name').value);categoryChecklist($('.collection-choices'),repo,[...selected,category.id]);$('.collection-name').value='';summary();});
  $('.collection-name').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('.collection-create').click();}};
  $('.collection-save').onclick=()=>run(async()=>{const r=request;if(!r)return;const ids=selectedCategories($('.collection-choices')),item=r.itemId?await repo.setCategories(r.itemId,ids):await repo.collect(r.info,r.entry,r.context,r.key,ids);busy=false;close(item);});
  panel.addEventListener('keydown',e=>{if(e.key==='Tab'){const nodes=[...panel.querySelectorAll('button,input')].filter(n=>!n.disabled),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&shadow.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&shadow.activeElement===last){e.preventDefault();first.focus();}}});
  new ResizeObserver(position).observe(panel);addEventListener('resize',position);
  return {isOpen:()=>!panel.hidden,close,async open(value){if(busy)return null;close();const version=epoch;await repo.ready;if(version!==epoch)return null;request=value;previousFocus=shadow.activeElement;const item=value.itemId?await repo.getItem(value.itemId):repo.find(value.info);if(version!==epoch)return null;$('.collection-word').textContent=value.info?.word||item?.expression||'收录';$('.collection-save').textContent=item?'保存分类':'确认收录';$('.collection-error').textContent='';$('.collection-name').value='';categoryChecklist($('.collection-choices'),repo,repo.categoryIds(item||{}));summary();panel.hidden=false;drag.raise();position();$('.collection-save').focus();return new Promise(done=>resolve=done);}};
}
