// Curated patterns; levels are study-guide estimates, not an official JLPT syllabus.
const rows = [
  ['ものの','N2','虽然……但是……','普通形／ナ形容词な ＋ ものの','承认前项事实，后项却不符合预期；较书面。','改善しつつあるものの、個人消費は弱い。'],
  ['とはいえ','N1','虽说……；话虽如此','普通形／名词 ＋ とはいえ','承认前项，再补充限制或相反情况。','春とはいえ、まだ寒い。'],
  ['にもかかわらず','N2','尽管……却……','普通形／名词（である） ＋ にもかかわらず','后项与前项通常带来的预期相反，语气较强。','雨にもかかわらず、試合を行った。'],
  ['にとどまらず','N1','不仅限于……','名词 ＋ にとどまらず','范围超出前项，常与も、まで呼应。','国内にとどまらず、海外にも広がる。'],
  ['ざるを得ない','N2','不得不……','动词未然形 ＋ ざるを得ない；する → せざるを得ない','受到现实条件限制，不情愿但没有其他选择。','計画を変更せざるを得ない。'],
  ['にほかならない','N2','正是……；无非是……','名词 ＋ にほかならない','强调本质或原因，带断定语气。','成功は努力の結果にほかならない。'],
  ['かねない','N2','有可能……（不良结果）','动词ます形去ます ＋ かねない','表示令人担心的不利可能性，并非能力不足。','事故を起こしかねない。'],
  ['に至るまで','N1','乃至……；连……都','名词 ＋ に至るまで','举出范围的极端或细节，强调覆盖全面。','細部に至るまで確認する。'],
  ['にあたって','N2','在……之际','名词／动词辞书形 ＋ にあたって','开始重要行动时，说明准备、方针或注意事项。','契約にあたって、条件を確認する。'],
  ['を踏まえて','N1','基于……；考虑到……','名词 ＋ を踏まえて／を踏まえた＋名词','以已知事实、经验或意见作为判断与行动的依据。','市場の動向を踏まえて、政策を見直した。'],
  ['ことから','N2','由于……；从……可知','普通形／ナ形容词な／名词である ＋ ことから','将前项事实作为判断依据或原因；需与单纯起点区分。','足跡があることから、誰かが来たと分かる。'],
  ['わけではない','N2','并非……；并不是说……','普通形／ナ形容词な／名词である ＋ わけではない','否定推论或进行部分否定，不一定全面否定事实。','すべてが悪いわけではない。'],
  ['に即して','N1','依据……；符合……','名词 ＋ に即して','按照实际情况、规则或标准处理。','実情に即して判断する。'],
  ['を余儀なくされる','N1','被迫……','名词 ＋ を余儀なくされる','外部因素迫使主体采取某行动，常用于书面报道。','撤退を余儀なくされた。'],
];
export const grammars = new Map(rows.map(([id,jlptLevel,meaning,grammarConnection,usage,example])=>[id,{
  id, type:'grammar', grammarPattern:`～${id}`, jlptLevel, meaning, grammarConnection, usage, explanation:usage,
  pos:'语法 · '+jlptLevel+'（学习参考）', example, source:'Yomi 人工整理语法 · 等级为学习参考',
  meaningEn: id==='を踏まえて'?'based on; consider; taking into account':'',
}]));
const variants = new Map([
  ['を踏まえて',/を踏まえ(?:て|た|(?=[、，。\s\p{Script=Han}]|$))/gu], ['を余儀なくされる',/を余儀なくされ(?:る|た|ている|ていた|ます|ました)/gu],
  ['にとどまらず',/に(?:とど|留)まらず/gu], ['にあたって',/に(?:あた|当)って/gu],
]);
function connectionOK(id, text, start, end, tokenizer) {
  const before=text.slice(Math.max(0,start-50),start), after=text.slice(end,end+70);
  if (id==='とはいえ' && (!before.trim() || /[。！？]\s*$/.test(before))) return true;
  if (!/[\p{L}]$/u.test(before)) return false;
  if (['ものの','ことから','わけではない'].includes(id)) {
    // Reject nominal もの + の (e.g. 本物の...), bare こと/わけ and incomplete clauses.
    if (!after || /^[。！？]/.test(after)) return id==='わけではない';
    if (!/(?:[うくぐすつぬぶむるたたいなだ]|ない|ある|いる|です|である)$/.test(before)) return false;
    if (tokenizer) {
      const last=tokenizer.tokenize(before).at(-1);
      if (last?.pos==='名詞' && !/^(な|だ)$/.test(last.surface_form)) return false;
    }
  }
  if (['ざるを得ない','かねない'].includes(id) && tokenizer) {
    const last=tokenizer.tokenize(before).at(-1);
    if (last?.pos!=='動詞' || (id==='かねない'&&!last.conjugated_form?.startsWith('連用')) || (id==='ざるを得ない'&&!last.conjugated_form?.startsWith('未然'))) return false;
  } else if (id==='ざるを得ない' && !/[わかがさざたなばまらせじ]$/.test(before)) return false;
  else if (id==='かねない' && !/[いきぎしちにびみりえけげせてねべめれ]$/.test(before)) return false;
  return true;
}
export function grammarMatches(text, tokenizer=null) {
  const matches=[];
  for (const [id,entry] of grammars) {
    const pattern=variants.get(id)||new RegExp(id,'gu'); pattern.lastIndex=0;
    for (const m of text.matchAll(pattern)) {
      let valid=false;try{valid=connectionOK(id,text,m.index,m.index+m[0].length,tokenizer);}catch{/* Failed grammar analysis must not disable ordinary word queries. */}
      if(valid)matches.push({start:m.index,end:m.index+m[0].length,word:m[0],base:id,normalized:m[0],lang:'ja',type:'grammar',grammarId:id,entry,reading:'',pos:entry.pos,method:'完整语法 · 接续规则匹配'});
    }
  }
  return matches.sort((a,b)=>a.start-b.start || (b.end-b.start)-(a.end-a.start)).filter((m,i,all)=>!all.slice(0,i).some(x=>x.start<=m.start&&x.end>=m.end));
}
