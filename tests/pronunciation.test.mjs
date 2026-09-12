import test from 'node:test';import assert from 'node:assert/strict';import {safeIPA,validateEntry} from '../src/core.js';import {withPronunciation} from '../src/pronunciation.js';import {LearningRepository} from '../src/learning.js';
test('IPA keeps stress and vowel/consonant symbols, rejects definitions and preserves missing dialects',()=>{
 assert.equal(safeIPA('/ˈsʌm.θɪŋ/'),'/ˈsʌm.θɪŋ/');assert.equal(safeIPA('/kæt/'),'/kæt/');assert.equal(safeIPA('/ðə/'),'/ðə/');assert.equal(safeIPA('中文定义'),'');assert.equal(safeIPA('<script>'),'');assert.equal(safeIPA('a'.repeat(101)),'');
 const entry=validateEntry({meaning:'测试',ipaUk:'/test/',ipaUs:''});assert.equal(entry.ipaUk,'/test/');assert.equal(entry.ipaUs,'');assert.equal(entry.pronunciationSource,'AI 推断');
});
test('Fallback pronunciation identifies its lemma and does not invent unknown words or the other dialect',()=>{
 const entry=withPronunciation({word:'learned',base:'learn',lang:'en'},{meaning:'学会'});assert.equal(entry.pronunciationWord,'learn');assert.equal(entry.ipaUk,'/lɜːn/');assert.equal(entry.ipaUs,'/lɝːn/');
 assert.equal(withPronunciation({word:'unknownword',lang:'en'},{meaning:'测试'}).ipaUk,undefined);const partial=withPronunciation({word:'test',lang:'en'},{ipaUk:'/test/'});assert.equal(partial.ipaUs,'');
});
test('Saved card identity, pronunciation and original context survive reload; knowledge edits do not reset review or categories',async()=>{
 const map=new Map(),storage={async get(k,d){return structuredClone(map.get(k)??d);},async set(k,v){map.set(k,structuredClone(v));},async keys(){return [...map.keys()];}};const repo=new LearningRepository(storage);await repo.ready;
 const cat=await repo.createCategory('英语'),info={word:'learned',base:'learn',lang:'en'},entry=withPronunciation(info,{meaning:'得知',contextMeaning:'得知消息'}),context={sentence:'I learned that it was closed.',url:'https://example.org/original',surface:'learned'};
 const item=await repo.collect(info,entry,context,null,[cat.id]);await repo.review(item.id,'good',{mode:'forward'});await repo.updateKnowledge(item.id,{meaning:'获悉',ipaUk:'/lɜːnd/',ipaUs:'/lɝːnd/',pronunciationWord:'learned',senses:[{meaning:'获悉',contextMatch:true}]});
 const fresh=new LearningRepository(storage);await fresh.ready;const saved=fresh.find(info);assert.equal(saved.cardInfo.word,'learned');assert.equal(saved.ipaUk,'/lɜːnd/');assert.equal(saved.pronunciationWord,'learned');assert.equal(saved.encounterCount,1);assert.equal(saved.reviewCount,1);assert.deepEqual(saved.categoryIds,[cat.id]);assert.equal(saved.senses[0].contextMatch,false);assert.equal((await fresh.records('contexts',saved.id,1))[0].url,context.url);
});
