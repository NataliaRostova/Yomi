export const HAN = /[\p{Script=Han}々〆]/u;
export const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
export const KATAKANA = /^[\p{Script=Katakana}ー・]+$/u;

export function hiragana(text = '') {
  return text.normalize('NFKC').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// Match okurigana against the reading; ambiguous compound readings stay grouped.
export function rubyParts(surface, reading) {
  const normalized = hiragana(reading);
  if (!normalized || normalized === '*') return [{ text: surface }];
  const groups = surface.match(/[\p{Script=Han}々〆]+|[^\p{Script=Han}々〆]+/gu) || [];
  const pattern = groups.map(g => HAN.test(g) ? '(.+?)' : hiragana(g).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
  const match = normalized.match(new RegExp(`^${pattern}$`, 'u'));
  if (!match) return [{ text: surface, reading: normalized }];
  let i = 1;
  return groups.map(text => HAN.test(text) ? { text, reading: match[i++] } : { text });
}

export function contextFor(element, word, max = 240) {
  const block = element.closest('p,li,article,section,td,blockquote,div') || element.parentElement;
  // Ruby readings are excluded from the text supplied as context.
  const copy = block?.cloneNode(true);
  copy?.querySelectorAll('rt,rp,[data-yomi-ui],script,style,input,textarea,select,[contenteditable],[role="textbox"],[hidden],[aria-hidden="true"]').forEach(n => n.remove());
  const text = (copy?.textContent || word).replace(/\s+/g, ' ').trim();
  const index = Math.max(0, text.indexOf(word));
  const start = Math.max(0, index - Math.floor(max / 3));
  return text.slice(start, start + max);
}

export function validateEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('请填写完整的 API 地址。'); }
  if (url.username || url.password || url.search || url.hash) throw new Error('API 地址不能包含账号、查询参数或片段。');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('API 地址需要 HTTPS；本机服务可使用 HTTP。');
  }
  return url.href;
}

export function aiResponseError(code,message){return Object.assign(new Error(message),{code});}
export function aiAnswerText(content) {
  if(Array.isArray(content))content=content.filter(part=>part?.type==='text'&&typeof part.text==='string').map(part=>part.text).join('');
  if(content==null)content='';
  if(typeof content!=='string')throw aiResponseError('AI_CONTENT_TYPE','接口返回的正文不是文本，请检查 Chat Completions 兼容设置。');
  if(content.length>30000)throw aiResponseError('AI_OUTPUT_SIZE','AI 正文超过 30,000 字符，已停止解析。请使用更简洁的输出。');
  let clean=content.trim();
  // Only remove complete, leading reasoning envelopes, never text inside JSON strings.
  while(/^<(think|analysis)>/i.test(clean)){
    const match=clean.match(/^<(think|analysis)>[\s\S]*?<\/\1>\s*/i);
    if(!match)throw aiResponseError('AI_EMPTY','AI 仅返回了未完成的思考内容，没有可用的最终答案。');
    clean=clean.slice(match[0].length).trim();
  }
  if(!clean)throw aiResponseError('AI_EMPTY','AI 返回了空的最终答案；可能尚未完成生成，请重试。');
  return clean;
}
function parseObjectJSON(text) {
  // Remove trailing commas outside quoted strings. Do not rewrite keys, quotes or values.
  let cleaned='',quoted=false,escaped=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){cleaned+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"')quoted=true;
    if(c===','&&/^\s*[}\]]/.test(text.slice(i+1)))continue;
    cleaned+=c;
  }
  const value=JSON.parse(cleaned);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Expected object');
  return value;
}
export function parseAIJSON(content) {
  const clean=aiAnswerText(content).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{return parseObjectJSON(clean);}catch{/* Recover one complete object surrounded by explanatory prose. */}
  const candidates=[];let start=-1,stack=[],quoted=false,escaped=false;
  for(let i=0;i<clean.length;i++){
    const c=clean[i];
    if(start<0){if(c==='{'||c==='['){start=i;stack=[c];}continue;}
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;continue;}
    if(c==='{'||c==='[')stack.push(c);
    if(c==='}'||c===']'){
      const open=stack.pop();if((open==='{'&&c!=='}')||(open==='['&&c!==']'))throw aiResponseError('AI_JSON','AI 返回的 JSON 括号不匹配。');
      if(!stack.length){candidates.push(clean.slice(start,i+1));start=-1;if(candidates.length>1)break;}
    }
  }
  if(candidates.length===1&&start<0){try{return parseObjectJSON(candidates[0]);}catch{/* Invalid JSON is never evaluated as JavaScript. */}}
  throw aiResponseError('AI_JSON',candidates.length>1?'AI 返回了多个 JSON 对象，无法确定应使用哪一个。':'AI 正文中没有完整、可解析的 JSON 对象；可能是格式错误或输出被截断。');
}

const string = (value, max = 800) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function safeIPA(value) {
  if(typeof value!=='string')return '';const raw=value.trim().replace(/^[/\[]|[/\]]$/g,'');
  return raw&&raw.length<=100&&/^[a-zæœøðθŋɑ-ʯɐ-ɿəˈˌːˑ˞. ()\-\u0300-\u036f]+$/u.test(raw)?`/${raw}/`:'';
}
export function normalizeExamples(value) {
  if(!Array.isArray(value))return [];
  const seen=new Set();return value.slice(0,6).flatMap(e=>{const text=string(e?.text||e?.example,400);if(!text||seen.has(text))return [];seen.add(text);return [{text,translation:string(e.translation,400),usage:string(e.usage,400)}];});
}
export function normalizeSenses(value) {
  if(!Array.isArray(value))return [];
  return value.slice(0,12).filter(s=>string(s?.meaning)).map(s=>({meaning:string(s.meaning,400),pos:string(s.pos,80),usage:string(s.usage,800),collocations:string(s.collocations,400),contextMatch:s.contextMatch===true,examples:normalizeExamples(s.examples)}));
}
export function validateEntry(data) {
  if (!data || typeof data !== 'object' || !string(data.meaning)) throw new Error('AI 返回的释义不完整。');
  return {
    meaning: string(data.meaning), usage: string(data.usage), reading: hiragana(string(data.reading, 100)),
    original: string(data.sourceWord || data.original, 120), sourceWord: string(data.sourceWord, 120),
    sourceWordConfidence: typeof data.sourceWordConfidence === 'number' ? Math.max(0, Math.min(1, data.sourceWordConfidence)) : 0,
    etymologyKind: string(data.etymologyKind, 40), domain: string(data.domain, 80), explanation: string(data.explanation, 4000),
    pos: string(data.pos, 80),
    ipaUk:safeIPA(data.ipaUk),ipaUs:safeIPA(data.ipaUs),pronunciationSource:'AI 推断',readingSource:'AI 推断',
    contextMeaning:string(data.contextMeaning,800),senses:normalizeSenses(data.senses),examples:normalizeExamples(data.examples),
    example: string(data.example, 400), translation: string(data.translation, 400), source: 'AI 生成 · 请结合上下文核对',
  };
}

export function cacheKey(info, context = '') {
  return JSON.stringify([info.lang, info.word, info.base, context]);
}

export class LRU {
  constructor(limit = 200) { this.limit = limit; this.map = new Map(); }
  get(key) {
    const value = this.map.get(key);
    if (value !== undefined) { this.map.delete(key); this.map.set(key, value); }
    return value;
  }
  set(key, value) {
    this.map.delete(key); this.map.set(key, value);
    if (this.map.size > this.limit) this.map.delete(this.map.keys().next().value);
    return value;
  }
}
