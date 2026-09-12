import { rubyParts } from './core.js';
import { safeOriginal,safeReading } from './annotation.js';
import { rangeFor,excluded,blockFor } from './text-engine.js';

// Zero-size inline anchors belong to the same scrolling/transform/sticky subtree
// as their source. Scrolling needs no event handler or JavaScript position update.
export function createAnnotationOverlay(getConfig) {
  const groups=new Map(),inline=new Map(),spacing=new Map(),measure=document.createElement('canvas').getContext('2d');let frame=0;
  const owned=el=>el?.closest('[data-yomi-ui],rt,rp');
  function anchor(node){const host=document.createElement('span');host.dataset.yomiUi='';host.dataset.yomiAnnotationAnchor='';host.setAttribute('aria-hidden','true');host.style.cssText='all:initial!important;display:inline!important;position:relative!important;font-size:0!important;line-height:0!important;pointer-events:none!important;user-select:none!important;';node.before(host);return host;}
  function drop(record){record.host.remove();}
  function partList(record){if(record.rt)return [{text:record.info.word,reading:record.rt.textContent}];const source=safeOriginal(record.original,record.info.word);return source?[{text:record.info.word,reading:source}]:rubyParts(record.info.word,safeReading(record.info.reading));}
  function nearby(node){const rects=[],root=blockFor(node),local=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue.trim()&&!excluded(n.parentElement)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});let count=0;
    // Only this formatting block: badges, neighbouring columns and sticky headers
    // must not be mistaken for a preceding text line that can be moved by leading.
    while(count++<2000&&local.nextNode()){const n=local.currentNode;if(blockFor(n)!==root)continue;const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects())if(b.width&&b.height)rects.push(b);}
    return rects;
  }
  function rows(range){const result=[];for(const b of range?.getClientRects()||[]){if(!b.width||!b.height)continue;const row=result.find(r=>Math.abs(r.top-b.top)<2&&Math.abs(r.bottom-b.bottom)<2);if(row){row.left=Math.min(row.left,b.left);row.right=Math.max(row.right,b.right);}else result.push({left:b.left,right:b.right,top:b.top,bottom:b.bottom});}return result;}
  function refresh(){frame=0;const config=getConfig(),plans=[],obstacles=new Map(),needed=new Map();
    const records=[];
    for(const [node,group] of groups){if(!node.isConnected||node.nodeValue!==group.raw){group.entries.forEach(drop);groups.delete(node);}else records.push(...group.entries);}
    for(const [node,record] of inline){if(!node.isConnected){drop(record);inline.delete(node);}else records.push(record);}
    for(const record of records){const node=record.node;if(!record.host.isConnected)continue;const el=node.parentElement,css=getComputedStyle(el),origin=record.host.getBoundingClientRect(),scale=(el.offsetWidth?el.getBoundingClientRect().width/el.offsetWidth:parseFloat(getComputedStyle(document.documentElement).zoom))||1;
      // Browser clips offscreen anchors naturally. Do not freeze them at viewport top.
      const visible=el.checkVisibility?el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}):css.visibility!=='hidden';
      const block=blockFor(node),other=obstacles.get(block)||nearby(node);obstacles.set(block,other);let at=record.info.start,index=0;
      for(const part of partList(record)){const start=at;at+=part.text.length;if(!part.reading)continue;
        const range=rangeFor(record.snapshot,start,at);
        const fragments=rows(range);const targetRows=fragments.length>1?[fragments.reduce((a,b)=>a.right-a.left>=b.right-b.left?a:b)]:fragments;
        // A wrapped word has one whole-word reading, not invented per-character readings.
        for(const row of targetRows){const width=row.right-row.left,desired=parseFloat(css.fontSize)*config.rubySize*scale;
          let available=desired+1;
          for(const b of other)if(b.right>row.left+.5&&b.left<row.right-.5&&b.bottom<row.bottom-parseFloat(css.fontSize)*scale*.65){available=Math.min(available,row.top-b.bottom-2);}
          if(visible&&available<desired+1&&block!==document.body&&block!==document.documentElement){
            const need=needed.get(block)||{line:0,cap:0};
            need.line=Math.max(need.line,(desired+1-available)/scale);
            need.cap=Math.max(need.cap,desired/scale+3);needed.set(block,need);
          }
          // Reserve the previous line's actual glyph box, not an assumed line-height.
          const size=desired;
          const show=visible&&config.siteEnabled&&config.annotationEnabled&&available>=desired;
          measure.font=`${size/scale}px ${css.fontFamily}`;
          plans.push({record,index:index++,text:part.reading,show,block,row,origin,scale,natural:measure.measureText(part.reading).width*scale+1,css:show?{left:(row.left-origin.left)/scale,top:(row.top-size-1-origin.top)/scale,width:width/scale,height:(size+1)/scale,size:size/scale,font:css.fontFamily,color:css.color,opacity:config.rubyOpacity}:null});
        }
      }
      record.count=Math.max(index,record.rt?1:0);if(!index&&record.rt)plans.push({record,index:0,text:record.rt.textContent,show:false});
    }
    // User-approved local leading: only enlarge the affected text block, never body.
    let relayout=false;
    for(const [block,need] of needed){if(need.line<.4)continue;const css=getComputedStyle(block),current=parseFloat(css.lineHeight)||parseFloat(css.fontSize)*1.2;let saved=spacing.get(block);
      if(!saved||saved.appliedLine&&block.style.getPropertyValue('line-height')!==saved.appliedLine){saved={line:block.style.getPropertyValue('line-height'),linePriority:block.style.getPropertyPriority('line-height'),base:current};spacing.set(block,saved);}
      const target=Math.min(saved.base+need.cap,current+need.line+.5);
      if(target-current<.4)continue;
      block.style.setProperty('line-height',`${target}px`,'important');saved.appliedLine=block.style.getPropertyValue('line-height');relayout=true;
    }
    if(relayout){for(const p of plans)if(needed.has(blockFor(p.record.node)))for(const label of p.record.labels)label.style.setProperty('display','none','important');schedule();return;}
    // Borrow unannotated horizontal space at a uniform font size. Bound every
    // displacement to the word's immediate neighbourhood; never change source width.
    const lines=new Map();for(const p of plans){if(!p.show)continue;const list=lines.get(p.block)||[];let line=list.find(l=>Math.abs(l[0].row.bottom-p.row.bottom)<2);if(!line){line=[];list.push(line);}line.push(p);lines.set(p.block,list);}
    for(const list of lines.values())for(const line of list){line.sort((a,b)=>a.row.left-b.row.left);const edges=line.map(p=>{const extra=p.css.size*p.scale*1.4;return {left:p.row.left-extra,right:p.row.right+extra};});
      for(let i=0;i<line.length;i++){const p=line[i],e=edges[i],center=(p.row.left+p.row.right)/2;
        // Start centered. A backwards pass below returns overflow into earlier gaps.
        const width=Math.min(p.natural,e.right-e.left),left=Math.max(e.left,center-width/2,i?edges[i-1].end+2:-Infinity);e.start=left;e.end=left+width;
      }
      for(let i=line.length-1;i>=0;i--){const e=edges[i],limit=Math.min(e.right,i<line.length-1?edges[i+1].start-2:Infinity),overflow=Math.max(0,e.end-limit);e.start=Math.max(e.left,e.start-overflow);e.end=Math.max(e.start,Math.min(e.end-overflow,limit));}
      for(let i=0;i<line.length;i++){const p=line[i],e=edges[i];const left=Math.max(e.start,i?edges[i-1].end+2:e.start);p.css.left=(left-p.origin.left)/p.scale;p.css.width=Math.max(0,e.end-left)/p.scale;}
    }
    // Geometry reads above; writes below. Avoid one forced layout per annotation.
    for(const p of plans){const r=p.record;let label=r.labels[p.index];if(!label){label=document.createElement('span');label.dataset.yomiAnnotation='';r.host.append(label);r.labels[p.index]=label;}label.dataset.surface=r.info.word;label.dataset.yomiCollision=p.show?'clear':'insufficient-space';if(label.textContent!==p.text)label.textContent=p.text;
      const c=p.css,styles=p.show?{display:'block',position:'absolute',left:c.left+'px',top:c.top+'px',bottom:'auto',transform:'none','max-width':'none',width:c.width+'px',height:c.height+'px','font-family':c.font,'font-size':c.size+'px','font-weight':'400','line-height':'1',color:c.color,opacity:String(c.opacity),'white-space':'nowrap','text-align':'center',overflow:'hidden','text-overflow':'ellipsis','letter-spacing':'normal','pointer-events':'none','user-select':'none'}:{display:'none'};
      for(const [key,value] of Object.entries(styles))if(label.style.getPropertyValue(key)!==value)label.style.setProperty(key,value,'important');
    }
    for(const r of records)while(r.labels.length>r.count)r.labels.pop().remove();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(refresh);}
  function restoreSpacing(){for(const [block,s] of spacing){if(block.style.getPropertyValue('line-height')===s.appliedLine){if(s.line)block.style.setProperty('line-height',s.line,s.linePriority);else block.style.removeProperty('line-height');}if(block.style.getPropertyValue('padding-top')===s.appliedPadding){if(s.padding)block.style.setProperty('padding-top',s.padding,s.paddingPriority);else block.style.removeProperty('padding-top');}}spacing.clear();}
  const resized=()=>{restoreSpacing();schedule();};addEventListener('resize',resized,{passive:true});visualViewport?.addEventListener('resize',resized);
  const resize=new ResizeObserver(schedule);resize.observe(document.body);
  new MutationObserver(changes=>{if(changes.some(r=>!owned(r.target.nodeType===3?r.target.parentElement:r.target)))schedule();}).observe(document.body,{subtree:true,attributes:true,childList:true,characterData:true});document.fonts?.addEventListener('loadingdone',schedule);
  function record(node,snapshot,info,original,rt){const host=anchor(node);if(rt)host.append(rt);return {node,host,snapshot,info,original,rt,labels:rt?[rt]:[],count:0};}
  return {has:node=>groups.get(node)?.raw===node.nodeValue,
    add(node,snapshot,infos,originalFor){groups.get(node)?.entries.forEach(drop);const entries=infos.filter(info=>info.type!=='grammar').map(info=>record(node,snapshot,info,originalFor(info.word)));groups.set(node,{raw:node.nodeValue,entries});resize.observe(node.parentElement);schedule();},
    attach(node,rt){if(inline.has(node))return;rt.style.setProperty('display','none','important');const snapshot={text:node.nodeValue,segments:[{node,nodeStart:0,start:0,end:node.length}]};inline.set(node,record(node,snapshot,{word:node.nodeValue,start:0},null,rt));schedule();},
    update(word,original){for(const group of groups.values())for(const r of group.entries)if(r.info.word===word)r.original=original;schedule();},
    refresh:schedule,
    clear(){restoreSpacing();for(const group of groups.values())group.entries.forEach(drop);for(const r of inline.values())drop(r);groups.clear();inline.clear();resize.disconnect();resize.observe(document.body);},
  };
}
