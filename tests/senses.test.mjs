import test from 'node:test';import assert from 'node:assert/strict';import {validateEntry} from '../src/core.js';import {AIClient} from '../src/network.js';import {localEntry} from '../src/lexicon.js';
import {LearningRepository} from '../src/learning.js';
test('Sense schema preserves separate meanings, examples and use cases with bounded untrusted data',()=>{
 const entry=validateEntry({meaning:'学习；得知',senses:[{meaning:'学习',examples:[{text:'Example.',translation:'例句',usage:'用法'},{text:'Example.'},{text:42}]},{meaning:'得知',contextMatch:'true',examples:[{text:'Another.'}]},null],examples:'invalid'});
 assert.equal(entry.senses.length,2);assert.equal(entry.senses[0].examples.length,1);assert.equal(entry.senses[0].examples[0].usage,'用法');assert.equal(entry.senses[1].contextMatch,false);assert.deepEqual(entry.examples,[]);
 const huge=validateEntry({meaning:'测试',senses:Array.from({length:50},()=>({meaning:'释义',examples:Array.from({length:30},(_,i)=>({text:String(i)}))}))});assert.equal(huge.senses.length,12);assert.equal(huge.senses[0].examples.length,6);
});
test('No-context requests cannot retain a model claim that the current sense is confirmed',async()=>{
 globalThis.GM_xmlhttpRequest=o=>o.onload({status:200,responseText:JSON.stringify({choices:[{message:{content:JSON.stringify({meaning:'测试',contextMeaning:'无依据的语境判断',senses:[{meaning:'测试',contextMatch:true}]})}}]})});
 const client=new AIClient(()=>({aiEnabled:true,endpoint:'https://example.com/chat/completions',model:'mock'}));const entry=await client.lookup({word:'test',lang:'en'});assert.equal(entry.contextMeaning,'');assert.equal(entry.senses[0].contextMatch,false);
});
test('Curated Japanese loanword and English entries have independently associated sense examples',()=>{
 for(const info of [{word:'learned',base:'learn',lang:'en'},{word:'パワー',lang:'ja'}]){const entry=localEntry(info);assert.equal(entry.senses.length,2);assert.ok(entry.senses.every(s=>s.examples.length>=2&&s.usage));}
});
test('Collected sense examples survive reload without reusing a context-match claim on another page',async()=>{
 const data=new Map(),storage={async get(k,d){return structuredClone(data.get(k)??d);},async set(k,v){data.set(k,structuredClone(v));},async keys(){return [...data.keys()];}};
 const repo=new LearningRepository(storage);await repo.ready;const entry=structuredClone(localEntry({word:'learn',lang:'en'}));entry.senses[1].contextMatch=true;const info={word:'learned',base:'learn',lang:'en'};
 await repo.collect(info,entry,{sentence:'I learned that it was closed.'});const next=new LearningRepository(storage);await next.ready;const item=next.find(info);assert.equal(item.senses.length,2);assert.equal(item.senses[1].examples.length,2);assert.ok(item.senses.every(s=>!s.contextMatch));assert.equal(item.example,entry.example||entry.senses[1].examples[0].text);
});
