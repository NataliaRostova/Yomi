import { HAN, KANA, KATAKANA, hiragana, LRU } from './core.js';
import { english, japanese, loans, englishForms, phrases } from './lexicon.js';
import { grammarMatches } from './grammar.js';

// Query exclusions deliberately do NOT include ruby or our annotation wrappers.
export const EXCLUDED = 'script,style,noscript,textarea,input,select,pre,code,kbd,samp,svg,math,canvas,iframe,rt,rp,[data-yomi-ui],[contenteditable]:not([contenteditable="false"]),[role="textbox"],[translate="no"],[hidden],[aria-hidden="true"]';
export function excluded(element) { return !element || !!element.closest(EXCLUDED) || element.isContentEditable; }
const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity:'grapheme' }) : null;
const jaSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity:'word' }) : null;
const analysisCache = new LRU(100);
const lemmaReadings = new LRU(1000);
function baseReading(base,tokenizer){if(!tokenizer)return '';let reading=lemmaReadings.get(base);if(reading===undefined){try{reading=hiragana(tokenizer.tokenize(base).map(t=>t.reading||'').join(''));}catch{reading='';}lemmaReadings.set(base,reading);}return reading;}

export function normalizeMapped(raw) {
  let text = ''; const starts = [], ends = [];
  const segments = graphemes ? graphemes.segment(raw) : Array.from(raw).map((segment, i, all) => ({ segment, index:all.slice(0,i).join('').length }));
  for (const {segment, index} of segments) {
    const normalized = segment.normalize('NFKC').replace(/[’‘]/g, "'").replace(/[‐‑–]/g, '-');
    text += normalized;
    for (let i=0; i<normalized.length; i++) { starts.push(index); ends.push(index+segment.length); }
  }
  return { text, starts, ends, raw };
}

export function blockFor(node) {
  let element = node.nodeType === 1 ? node : node.parentElement;
  while (element && element !== document.body) {
    const display = getComputedStyle(element).display;
    if (!['inline','contents','ruby','ruby-base','ruby-text'].includes(display) && !element.hasAttribute('data-yomi-token')) return element;
    element = element.parentElement;
  }
  return element || document.body;
}

// A bounded, read-only text projection around the pointer; every offset maps back to its DOM node.
export function captureAround(node, offset = 0, radius = 900) {
  if (node?.nodeType !== 3 || excluded(node.parentElement)) return null;
  const root = blockFor(node);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(value) {
      if (value.nodeType === 1) {
        if (excluded(value)) return NodeFilter.FILTER_REJECT;
        const css = getComputedStyle(value);
        if (css.display === 'none' || css.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
        return value.tagName === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const left = [], right = [];
  let remaining = Math.max(0, radius - offset), count=0;
  walker.currentNode = node;
  while (remaining>0 && count++<100 && walker.previousNode()) {
    const n=walker.currentNode, value=n.nodeType===3?n.nodeValue:'\n';
    const begin=Math.max(0,value.length-remaining);
    left.unshift({node:n, value:value.slice(begin), nodeStart:begin}); remaining-=value.length;
  }
  const begin=Math.max(0,offset-radius), end=Math.min(node.length,offset+radius);
  const center={node, value:node.nodeValue.slice(begin,end), nodeStart:begin};
  remaining=Math.max(0,radius-(node.length-offset)); count=0; walker.currentNode=node;
  while (remaining>0 && count++<100 && walker.nextNode()) {
    const n=walker.currentNode, value=n.nodeType===3?n.nodeValue:'\n';
    right.push({node:n,value:value.slice(0,remaining),nodeStart:0}); remaining-=value.length;
  }
  let text='', target=0;
  const segments=[...left,center,...right].map(piece=>{
    const start=text.length; text+=piece.value;
    if(piece===center) target=start+offset-begin;
    return {...piece,start,end:text.length};
  });
  return { text, target, segments, root, lang:node.parentElement.closest('[lang]')?.lang?.toLowerCase() || '' };
}

export function sentenceAt(text, offset, max=240) {
  let start=offset, end=offset;
  while(start>0 && !/[。！？!?\n]/.test(text[start-1]) && start>offset-max) start--;
  while(end<text.length && !/[。！？!?\n]/.test(text[end]) && end<offset+max) end++;
  if(end<text.length && /[。！？!?]/.test(text[end])) end++;
  if(end-start>max) { start=Math.max(start,offset-Math.floor(max/3)); end=Math.min(end,start+max); }
  return text.slice(start,end).trim();
}

export function rangeFor(snapshot,start,end) {
  const first=snapshot.segments.find(s=>s.node.nodeType===3 && s.end>start && s.start<=start);
  const last=[...snapshot.segments].reverse().find(s=>s.node.nodeType===3 && s.start<end && s.end>=end);
  if(!first || !last || !first.node.isConnected || !last.node.isConnected) return null;
  try { const range=document.createRange(); range.setStart(first.node,first.nodeStart+start-first.start); range.setEnd(last.node,last.nodeStart+end-last.start); return range; } catch { return null; }
}

export function pointText(x,y) {
  let node,offset;
  const caret=document.caretPositionFromPoint?.(x,y);
  if(caret) { node=caret.offsetNode; offset=caret.offset; }
  if(node?.nodeType!==3) { const range=document.caretRangeFromPoint?.(x,y); node=range?.startContainer; offset=range?.startOffset; }
  const hitGlyph=(node,at)=>{
    if(at<0||at>=node.length||!/[\p{L}\p{M}ー々〆]/u.test(String.fromCodePoint(node.nodeValue.codePointAt(at))))return null;
    const r=document.createRange();r.setStart(node,at);r.setEnd(node,Math.min(node.length,at+(node.nodeValue.codePointAt(at)>65535?2:1)));
    return [...r.getClientRects()].some(b=>x>=b.left-1&&x<=b.right+1&&y>=b.top-1&&y<=b.bottom+1)?{node,offset:at}:null;
  };
  // Caret APIs also return the nearest line for blank space. Require an actual glyph hit.
  for(const at of node?.nodeType===3&&!excluded(node.parentElement)?[offset,offset-1]:[]) {
    if(at<0 || at>=node.length) continue;
    const range=document.createRange(); range.setStart(node,at); range.setEnd(node,Math.min(node.length,at+(node.nodeValue.codePointAt(at)>65535?2:1)));
    const hit=[...range.getClientRects()].some(b=>x>=b.left-1 && x<=b.right+1 && y>=b.top-1 && y<=b.bottom+1);
    if(hit && /[\p{L}\p{M}ー々〆]/u.test(String.fromCodePoint(node.nodeValue.codePointAt(at)))) return {node,offset:at};
  }
  // Native caret APIs often stop outside buttons / user-select:none labels.
  // Read only the hit element, with a strict budget; never cancel its click.
  const target=document.elementFromPoint(x,y);
  if(excluded(target))return null;
  const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,{acceptNode:n=>excluded(n.parentElement)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  let count=0,budget=600;
  while(count++<24&&budget>0&&walker.nextNode()){
    const n=walker.currentNode,r=document.createRange();r.selectNodeContents(n);
    if(![...r.getClientRects()].some(b=>x>=b.left-1&&x<=b.right+1&&y>=b.top-1&&y<=b.bottom+1))continue;
    for(let at=0;at<n.length&&budget-->0;at+=n.nodeValue.codePointAt(at)>65535?2:1){const hit=hitGlyph(n,at);if(hit)return hit;}
  }
  return null;
}

// Compact paragraphs retain the no-annotation rule. A single-line heading can
// use existing whitespace above it, without changing its box or line height.
export function hasAnnotationRoom(node) {
  const css=getComputedStyle(node.parentElement),size=parseFloat(css.fontSize);
  if(parseFloat(css.lineHeight)>=size*1.5)return true;
  const heading=node.parentElement.closest('h1,h2,h3,h4,h5,h6');if(!heading)return false;
  const r=document.createRange();r.selectNodeContents(heading);
  const rects=[...r.getClientRects()].filter(b=>b.width&&b.height);
  if(!rects.length||Math.max(...rects.map(b=>b.top))-Math.min(...rects.map(b=>b.top))>size*.3)return false;
  const top=Math.min(...rects.map(b=>b.top));
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>!n.nodeValue.trim()||excluded(n.parentElement)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});walker.currentNode=node;
  for(let count=0;count<80&&walker.previousNode();count++){
    const prev=walker.currentNode;if(heading.contains(prev))continue;
    r.selectNodeContents(prev);const b=r.getBoundingClientRect();
    if(!b.width||!b.height||getComputedStyle(prev.parentElement).visibility==='hidden')continue;
    return top-b.bottom>=size*.6;
  }
  return top>=size*.6;
}

function nativeJa(text) {
  if(jaSegmenter) return [...jaSegmenter.segment(text)].filter(s=>s.isWordLike).map(s=>({surface_form:s.segment,basic_form:s.segment,offset:s.index,method:'浏览器分词 · 候选'}));
  // Last-resort chunks are deliberately bounded and labelled, never given invented readings.
  return [...text.matchAll(/[\p{Script=Han}々〆]{1,8}|[\p{Script=Katakana}ー]{1,20}|[\p{Script=Hiragana}]{1,8}/gu)].map(m=>({surface_form:m[0],basic_form:m[0],offset:m.index,method:'字符边界 · 待确认'}));
}
function japaneseTokens(text,tokenizer) {
  const key=`${tokenizer?'dict':'native'}:${text}`;
  let tokens=analysisCache.get(key); if(tokens) return tokens;
  if(!tokenizer) return analysisCache.set(key,nativeJa(text));
  let cursor=0;
  let parsed;try{parsed=tokenizer.tokenize(text);}catch{return nativeJa(text).map(t=>({...t,method:'分析异常 · 浏览器分词候选'}));}
  tokens=parsed.map(t=>{
    const offset=text.indexOf(t.surface_form,cursor); cursor=offset+t.surface_form.length;
    return {...t,offset,method:'IPADIC 分词'};
  }).filter(t=>t.offset>=0);
  // Keep an inflected verb and its auxiliaries together; do not glue arbitrary nouns.
  const merged=[];
  for(let i=0;i<tokens.length;i++) {
    const token={...tokens[i]};
    if(['動詞','形容詞'].includes(token.pos)) {
      let end=token.offset+token.surface_form.length, suffixes=0;
      while(i+1<tokens.length && suffixes<4) {
        const next=tokens[i+1];
        if(next.offset!==end || !(next.pos==='助動詞' || (next.pos==='助詞' && /^(て|で)$/.test(next.surface_form)))) break;
        token.surface_form+=next.surface_form; token.reading=token.reading && next.reading ? token.reading+next.reading : '';
        end+=next.surface_form.length; i++; suffixes++;
      }
    }
    merged.push(token);
  }
  return analysisCache.set(key,merged);
}

export function analyze(snapshot,mode='auto',tokenizer=null) {
  const mapped=normalizeMapped(snapshot.text), normalized=mapped.text;
  const japaneseContext=mode==='ja' || snapshot.lang?.startsWith('ja') || KANA.test(normalized);
  const output=[];
  const add=(start,end,info)=>{
    if(end<=start) return;
    const rawStart=mapped.starts[start],rawEnd=mapped.ends[end-1];
    output.push({...info,start:rawStart,end:rawEnd,word:snapshot.text.slice(rawStart,rawEnd),normalized:normalized.slice(start,end)});
  };
  const matches=[...normalized.matchAll(/[\p{Script=Latin}\p{M}]+(?:['-][\p{Script=Latin}\p{M}]+)*|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆]+/gu)];
  for(const match of matches) {
    const run=match[0],start=match.index;
    if(/\p{Script=Latin}/u.test(run)) {
      const forms=englishForms(run),base=forms.find(f=>english.has(f)) || forms[0];
      add(start,start+run.length,{lang:'en',base,forms,method:base!==run.toLowerCase()?'词形还原 · 本地匹配':'英文词边界'}); continue;
    }
    if(mode==='en' || (!japaneseContext && !KATAKANA.test(run))) continue;
    if(KATAKANA.test(run)) { add(start,start+run.length,{lang:'ja',base:run,reading:'',method:'片假名词边界'}); continue; }
    for(const token of japaneseTokens(run,tokenizer)) {
      if(!/[\p{L}]/u.test(token.surface_form)) continue;
      const base=token.basic_form && token.basic_form!=='*'?token.basic_form:token.surface_form;
      add(start+token.offset,start+token.offset+token.surface_form.length,{lang:'ja',base,baseReading:baseReading(base,tokenizer),reading:hiragana(token.reading||''),pos:token.pos,method:token.method});
    }
  }
  // Contiguous katakana compounds are one query object, even inside a mixed-script run.
  if(mode!=='en')for(const m of normalized.matchAll(/[\p{Script=Katakana}][\p{Script=Katakana}ー]{1,39}/gu)) {
    const start=mapped.starts[m.index],end=mapped.ends[m.index+m[0].length-1];
    for(let i=output.length-1;i>=0;i--)if(output[i].start>=start&&output[i].end<=end)output.splice(i,1);
    output.push({word:snapshot.text.slice(start,end),normalized:m[0],base:m[0],start,end,lang:'ja',reading:'',type:'loanword',method:'完整片假名表达 · 词源待核对'});
  }
  return output.sort((a,b)=>a.start-b.start);
}

export function candidatesAt(snapshot,mode='auto',tokenizer=null) {
  if(mode!=='en') {
    const mapped=normalizeMapped(snapshot.text);
    const grammar=grammarMatches(mapped.text,tokenizer).map(g=>({...g,start:mapped.starts[g.start],end:mapped.ends[g.end-1]})).find(g=>snapshot.target>=g.start&&snapshot.target<g.end);
    if(grammar)return [{...grammar,word:snapshot.text.slice(grammar.start,grammar.end)}];
  }
  const tokens=analyze(snapshot,mode,tokenizer);
  const current=tokens.find(t=>snapshot.target>=t.start && snapshot.target<t.end);
  if(!current) return [];
  const candidates=[];
  if(current.lang==='en') {
    const at=tokens.indexOf(current);
    // Only known expressions can outrank the word. A separated particle may span <=2 object words.
    for(let i=Math.max(0,at-3);i<=at;i++) for(let j=Math.max(i+1,at);j<=Math.min(tokens.length-1,i+3);j++) {
      const first=tokens[i],last=tokens[j];
      if(first.lang!=='en'||last.lang!=='en'||/[.!?;\n,]/.test(snapshot.text.slice(first.end,last.start))) continue;
      const middle=tokens.slice(i+1,j);
      const bases=englishForms(first.word);
      const phrase=bases.map(b=>`${b} ${last.normalized.toLowerCase()}`).find(p=>phrases.has(p));
      const tail=tokens.slice(i+1,j+1).map(t=>t.normalized.toLowerCase()).join(' ');
      const exact=bases.map(base=>`${base} ${tail}`).find(expression=>phrases.has(expression));
      if(exact || (phrase && (j===i+1 || middle.every(t=>/^(it|them|me|him|her|us|the|a|an|coat|word|light|book)$/i.test(t.word))) && (at===i||at===j))) {
        candidates.push({...current,start:first.start,end:last.end,word:snapshot.text.slice(first.start,last.end),base:exact||phrase,method:'已收录多词表达 · 请结合语境',isPhrase:true});
      }
    }
  }
  candidates.push(current);
  // Bounded Japanese compound repairs: only promote compounds present in a local dictionary.
  if(current.lang==='ja') {
    const index=tokens.indexOf(current);
    for(let i=Math.max(0,index-2);i<=index;i++) for(let j=index;j<=Math.min(tokens.length-1,i+2);j++) {
      if(i===j) continue;
      const raw=snapshot.text.slice(tokens[i].start,tokens[j].end),key=raw.normalize('NFKC');
      if(japanese.has(key)||loans.has(key)) candidates.unshift({...current,start:tokens[i].start,end:tokens[j].end,word:raw,base:key,baseReading:baseReading(key,tokenizer),reading:tokens.slice(i,j+1).map(t=>t.reading||'').join(''),method:'本地复合词匹配'});
    }
  }
  if(current.lang==='ja')candidates.sort((a,b)=>Number(b.method==='本地复合词匹配')-Number(a.method==='本地复合词匹配')||(b.end-b.start)-(a.end-a.start));
  return candidates.filter((c,i,all)=>all.findIndex(other=>other.start===c.start&&other.end===c.end&&other.base===c.base)===i).slice(0,6);
}

export function selectedText(range) {
  const copy=range.cloneContents();
  copy.querySelectorAll('rt,rp,'+EXCLUDED).forEach(n=>n.remove());
  return copy.textContent.trim();
}
