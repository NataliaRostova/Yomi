export const viewBounds=()=>({left:window.visualViewport?.offsetLeft||0,top:window.visualViewport?.offsetTop||0,width:window.visualViewport?.width||innerWidth,height:window.visualViewport?.height||innerHeight});
export function clampPanel(panel,x,y){const v=viewBounds();return {x:Math.max(v.left,Math.min(x,v.left+v.width-panel.offsetWidth)),y:Math.max(v.top,Math.min(y,v.top+v.height-panel.offsetHeight))};}
let front=10;
// Shared window behavior for cards, settings, Library and Review. No dock dead zone.
export function makeDraggable(panel,handle,onMove=()=>{}) {
  let gesture=null,geometry=null,maximized=false,restore=null;
  const minimum=()=>({width:Math.min(panel.matches('.settings,.library')?320:260,viewBounds().width),height:Math.min(panel.matches('.settings')?380:panel.matches('.library,.tooltip')?300:240,viewBounds().height)});
  function limits(){const v=viewBounds();panel.style.maxWidth=`${v.width}px`;panel.style.maxHeight=`${v.height}px`;panel.style.right='auto';panel.style.bottom='auto';}
  function paint(rect){limits();const v=viewBounds(),m=minimum();const width=Math.min(v.width,Math.max(m.width,rect.width)),height=Math.min(v.height,Math.max(m.height,rect.height));panel.style.width=width+'px';panel.style.height=height+'px';const p=clampPanel(panel,rect.x,rect.y);panel.style.left=p.x+'px';panel.style.top=p.y+'px';return {...p,width,height};}
  function reflow(){if(panel.hidden||gesture)return;limits();if(maximized){const v=viewBounds();paint({x:v.left,y:v.top,width:v.width,height:v.height});}else if(geometry)paint(geometry);}
  function raise(){panel.style.zIndex=String(++front);}
  function finish(){if(!gesture)return;gesture=null;delete panel.dataset.dragging;onMove();}
  function start(e,edge=''){if(e.button!==0||(!edge&&e.target.closest('button,input,a')))return;raise();for(const a of panel.getAnimations())a.cancel();if(maximized)return;const b=panel.getBoundingClientRect();geometry={x:b.x,y:b.y,width:b.width,height:b.height};gesture={edge,sx:e.clientX,sy:e.clientY,...geometry};panel.dataset.dragging='true';e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}
  function move(e){if(!gesture)return;const g=gesture,v=viewBounds(),m=minimum(),dx=e.clientX-g.sx,dy=e.clientY-g.sy;let r={x:g.x,y:g.y,width:g.width,height:g.height};
    if(!g.edge){r.x+=dx;r.y+=dy;}else{
      if(g.edge.includes('e'))r.width=Math.max(m.width,Math.min(v.left+v.width-g.x,g.width+dx));
      if(g.edge.includes('s'))r.height=Math.max(m.height,Math.min(v.top+v.height-g.y,g.height+dy));
      if(g.edge.includes('w')){r.x=Math.max(v.left,Math.min(g.x+g.width-m.width,g.x+dx));r.width=g.x+g.width-r.x;}
      if(g.edge.includes('n')){r.y=Math.max(v.top,Math.min(g.y+g.height-m.height,g.y+dy));r.height=g.y+g.height-r.y;}
    }geometry=paint(r);
  }
  function bind(element,edge=''){element.addEventListener('pointerdown',e=>start(e,edge));element.addEventListener('pointermove',move);for(const event of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(event,finish);}
  handle.classList.add('drag-handle');handle.tabIndex=0;handle.setAttribute('aria-label','拖动窗口；方向键移动；双击最大化或还原');handle.title='拖动位置 · 双击最大化 / 还原';bind(handle);
  const heading=panel.querySelector('.settings-heading h2,.library-heading h2');if(heading){heading.classList.add('drag-handle');heading.title='拖动窗口';bind(heading);}
  panel.addEventListener('pointerdown',raise,{capture:true});
  const max=document.createElement('button');max.className='icon window-maximize';max.setAttribute('aria-label','最大化窗口');max.textContent='□';max.title='最大化 / 还原';
  let controls=handle.querySelector('.tools');if(!controls){controls=document.createElement('div');controls.className='tools';const close=handle.querySelector('.close,.child-close');if(close)controls.append(close);handle.append(controls);}controls.insertBefore(max,controls.querySelector('.close,.child-close'));
  function toggle(){finish();if(!maximized){const b=panel.getBoundingClientRect();restore=geometry||{x:b.x,y:b.y,width:b.width,height:b.height};maximized=true;}else{maximized=false;geometry=restore;}panel.dataset.maximized=String(maximized);max.textContent=maximized?'❐':'□';max.setAttribute('aria-label',maximized?'还原窗口':'最大化窗口');raise();reflow();onMove();}
  max.onclick=toggle;handle.addEventListener('dblclick',e=>{if(!e.target.closest('button'))toggle();});
  handle.addEventListener('keydown',e=>{if(e.target!==handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||maximized)return;e.preventDefault();const b=panel.getBoundingClientRect();geometry=paint({x:b.x+(e.key==='ArrowLeft'?-24:e.key==='ArrowRight'?24:0),y:b.y+(e.key==='ArrowUp'?-24:e.key==='ArrowDown'?24:0),width:b.width,height:b.height});onMove();});
  for(const edge of ['n','e','s','w','ne','nw','se','sw']){const grip=document.createElement('span');grip.className='window-resize';grip.dataset.edge=edge;grip.setAttribute('aria-hidden','true');panel.append(grip);bind(grip,edge);}
  return {isDragging:()=>!!gesture,cancel:finish,hasGeometry:()=>!!geometry||maximized,reflow,raise};
}
