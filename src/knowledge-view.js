// Text-only rendering shared by the page card and the example explorer.
// Old dictionary entries remain usable without inventing sense/example associations.
export function renderKnowledge(container,entry,decorate,{child=false}={}) {
  container.replaceChildren();if(!entry)return;
  const add=(root,tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;e.textContent=text||'';root.append(e);return e;};
  const examples=(root,list)=>{if(!list.length){add(root,'p','note','暂无该义项的补充例句，可用 AI 补充。');return;}
    add(root,'div','label','SUPPLEMENT / 补充例句 · '+(entry.source?.includes('AI')?'AI 生成':'词库例句'));
    list.forEach((e,i)=>{const wrap=add(root,'div','sense-example','');add(wrap,'div','example-index',String(i+1).padStart(2,'0'));decorate(add(wrap,'div',child?'child-example example':'example',''),e.text);add(wrap,'div',child?'child-translation translation':'translation',e.translation);if(e.usage)add(wrap,'p','note','用法：'+e.usage);});
  };
  if(entry.senses?.length){
    add(container,'div','label','SENSES / 已提供的义项');
    entry.senses.forEach((sense,i)=>{const section=add(container,'section','sense','');section.dataset.contextMatch=String(!!sense.contextMatch);add(section,'h4','sense-heading',`${i+1}. ${sense.meaning}${sense.contextMatch?' · 当前语境（AI 判断）':''}`);if(sense.pos)add(section,'div','metadata',sense.pos);add(section,'p','sense-usage',sense.usage||'暂无此义项的用法说明。');if(sense.collocations)add(section,'p','note','搭配：'+sense.collocations);examples(section,sense.examples||[]);});
    if(entry.examples?.length){add(container,'div','label','未关联具体义项的补充例句');examples(container,entry.examples);}
  }else{
    const points=(entry.meaning||'').split(/[；;]/).map(s=>s.trim()).filter(Boolean);
    if(points.length>1){add(container,'div','label','词库释义要点');const list=add(container,'ul','meaning-points','');points.forEach(p=>add(list,'li','',p));add(container,'p','note','词库尚未细分义项；以下为通用用法和例句，不代表适用于每个释义。');}
    const list=entry.examples?.length?entry.examples:entry.example?[{text:entry.example,translation:entry.translation}]:[];
    examples(container,list);
  }
  add(container,'p','note sense-scope',entry.senses?.length?'仅列出本次词库／AI 提供的义项，不保证穷尽所有专业和罕见含义。':'需要更多义项、用法和例句时，可点击 AI 解释；未配置 AI 时保留现有词库内容。');
}
