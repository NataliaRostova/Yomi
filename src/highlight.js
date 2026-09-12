import { rangeFor } from './text-engine.js';
// Ranges leave links, handlers, text metrics and selection intact, including split inline text.
export function createHighlights() {
  const activeRanges={hover:[],active:[]}, fallback=document.createElement('div');
  fallback.dataset.yomiUi='';fallback.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483645';
  document.documentElement.append(fallback);
  const supports=typeof Highlight!=='undefined' && globalThis.CSS?.highlights;
  function draw() {
    fallback.replaceChildren();
    fallback.style.zoom=String(1/(parseFloat(getComputedStyle(document.documentElement).zoom)||1));
    for(const kind of ['hover','active']) {
      if(supports){CSS.highlights.set('yomi-'+kind,new Highlight(...activeRanges[kind]));continue;}
      for(const range of activeRanges[kind])for(const b of range.getClientRects()) {
        const box=document.createElement('i');box.style.cssText=`position:fixed;left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;background:#87977a24;box-shadow:inset 0 -1px #738167;pointer-events:none`;fallback.append(box);
      }
    }
  }
  function set(kind,snapshot,info) {
    // One range per text piece avoids including intervening ruby text in a split span.
    activeRanges[kind]=snapshot&&info?[...snapshot.segments].filter(s=>s.node.nodeType===3&&s.start<info.end&&s.end>info.start).map(s=>rangeFor(snapshot,Math.max(s.start,info.start),Math.min(s.end,info.end))).filter(Boolean):[];
    draw();
  }
  addEventListener('scroll',draw,{passive:true});addEventListener('resize',draw,{passive:true});
  return {set,clear(){activeRanges.hover=[];activeRanges.active=[];draw();}};
}
