import {grammars} from './grammar.js';
export const QUIZ_MODES=[['forward','日文／英文 → 中文'],['reverse','中文 → 原文'],['cloze','原句挖空'],['grammar','语法选择'],['context','语境理解']];
export function makeQuiz(item,contexts=[],mode='forward') {
  const context=contexts.find(c=>c.sentence&&c.surface&&c.sentence.includes(c.surface))||contexts[0];
  const sentence=context?.sentence||item.example||'',surface=context?.surface||item.expression.replace(/^[～~]/,'');
  const common={mode,itemId:item.id,sentence,contextSource:context?context.url:'内置例句',answer:item.meaningZh};
  if(mode==='reverse')return {...common,prompt:item.meaningZh,answer:[item.expression,item.reading].filter(Boolean).join(' / ')};
  if(mode==='cloze'&&sentence.includes(surface))return {...common,prompt:sentence.replace(surface,'＿＿＿＿'),answer:surface+' · '+item.meaningZh};
  if(mode==='grammar'&&item.type==='grammar'&&sentence.includes(surface)) {
    const correct=item.grammarPattern.replace(/^[～~]/,'');
    const choices=[correct,...[...grammars.keys()].filter(k=>k!==correct).slice(0,3)];
    // Stable rotation makes the correct option vary without changing on reveal.
    const offset=item.reviewCount%4;choices.push(...choices.splice(0,offset));
    return {...common,prompt:sentence.replace(surface,'＿＿＿＿'),choices,correct,answer:`${correct} · ${item.meaningZh}\n${item.explanation}`};
  }
  if(mode==='context'&&sentence)return {...common,prompt:`${sentence}\n\n「${surface}」在此处表达什么含义或语气？`,answer:item.meaningZh+'\n'+item.explanation};
  return {...common,mode:'forward',prompt:item.expression,note:mode==='forward'?'':'此项目缺少适用原句或不是语法，改用原文 → 中文。'};
}
