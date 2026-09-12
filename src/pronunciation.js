import {safeIPA} from './core.js';
import {safeReading} from './annotation.js';

// Small verified starter set; never derive an unknown English pronunciation from spelling.
// Sources and limitations: verification/SAVED-CARDS.md.
const known=new Map([
  ['learn',{ipaUk:'/lɜːn/',ipaUs:'/lɝːn/'}],
  ['policy',{ipaUk:'/ˈpɒl.ə.si/',ipaUs:'/ˈpɑː.lə.si/'}],
  ['power',{ipaUk:'/paʊə(r)/',ipaUs:'/ˈpaʊ.ɚ/'}],
]);
export function withPronunciation(info,entry) {
  if(!entry||info.lang!=='en')return entry;
  const word=(info.word||'').toLowerCase(),base=(info.base||word).toLowerCase();
  if(entry.ipaUk||entry.ipaUs)return {...entry,ipaUk:safeIPA(entry.ipaUk),ipaUs:safeIPA(entry.ipaUs),pronunciationWord:entry.pronunciationWord||info.word};
  const form=known.has(word)?word:known.has(base)?base:'';
  return form?{...entry,...known.get(form),pronunciationWord:form,pronunciationSource:'已核对基础音标'}:entry;
}
export function renderPronunciation(container,info,entry) {
  container.replaceChildren();container.hidden=!['ja','en'].includes(info.lang);
  const line=(label,value)=>{const row=document.createElement('div'),tag=document.createElement('span'),text=document.createElement('span');tag.className='pronunciation-label';tag.textContent=label;text.textContent=value;row.append(tag,text);container.append(row);};
  if(info.lang==='ja'){const reading=safeReading(info.reading||entry?.reading);line('読み',reading||'未收录读音 · 可通过 AI 或编辑补充');if(reading&&entry?.readingSource&&(!info.reading||info.reading===entry.reading||entry.readingSource==='用户编辑'))line('来源',entry.readingSource);return;}
  if(info.lang!=='en')return;
  const data=withPronunciation(info,entry)||{};if(data.pronunciationWord&&data.pronunciationWord!==info.word)line('音标对应',data.pronunciationWord);
  line('UK 英式',safeIPA(data.ipaUk)||'未收录');line('US 美式',safeIPA(data.ipaUs)||'未收录');
  line('来源',data.ipaUk||data.ipaUs?data.pronunciationSource||'已保存音标':'可用 AI 补充，或在编辑资料中填写；不会按拼写猜测。');
}
export function annotateCardWord(element,info,entry) {
  const reading=info.lang==='ja'?safeReading(info.reading||entry?.reading):'';
  if(reading&&/[\p{Script=Han}]/u.test(info.word))element.dataset.kana=reading;else delete element.dataset.kana;
}
