import test from 'node:test';import assert from 'node:assert/strict';
import { normalizeMapped,analyze,candidatesAt,sentenceAt } from '../src/text-engine.js';
import { englishForms,localEntry } from '../src/lexicon.js';
import kuromoji from 'kuromoji';
const snapshot=(text,word,lang='en')=>({text,target:text.indexOf(word)+1,lang});
test('normalization maps to untouched raw spans',()=>{
 const raw='ﾊﾟﾜｰ ＰＯＷＥＲ ﬃ 𠮷',m=normalizeMapped(raw);assert.equal(m.text,'パワー POWER ffi 𠮷');assert.equal(raw.slice(m.starts[0],m.ends[0]),'ﾊﾟ');
 const tokens=analyze({text:raw,lang:'ja'});assert.equal(tokens.find(t=>t.base==='power').word,'ＰＯＷＥＲ');assert.equal(tokens[0].word,'ﾊﾟﾜｰ');
});
test('inflections and known phrasal verbs have bounded candidates',()=>{
 assert.equal(candidatesAt(snapshot('She looked it up.','looked'))[0].base,'look up');assert.equal(candidatesAt(snapshot('She looked it up.','up'))[0].word,'looked it up');
 assert.equal(candidatesAt(snapshot('They gave up yesterday.','gave'))[0].base,'give up');assert.equal(candidatesAt(snapshot('We look. Up there.','look'))[0].word,'look');
 assert.equal(candidatesAt(snapshot('A very long unknown expression.','unknown'))[0].word,'unknown');assert.ok(englishForms('children').includes('child'));assert.ok(englishForms('studies').includes('study'));
 assert.equal(candidatesAt(snapshot('well‑known author','well'))[0].base,'well-known');
});
test('unannotated kana and unknown English yield candidates; Chinese is not misclassified',()=>{
 assert.ok(candidatesAt(snapshot('こんにちは。','こん','ja')).length);assert.equal(candidatesAt(snapshot('quizzaciously','quiz'))[0].word,'quizzaciously');
 assert.equal(candidatesAt(snapshot('今天学习汉字','学习','zh')).length,0);assert.ok(candidatesAt(snapshot('日本語','日本','zh'),'ja').length);
});
test('real IPADIC restores Japanese inflections',async()=>{
 const tokenizer=await new Promise((resolve,reject)=>kuromoji.builder({dicPath:'node_modules/kuromoji/dict'}).build((e,t)=>e?reject(e):resolve(t)));
 const c=candidatesAt(snapshot('パンを食べました。','食べ','ja'),'auto',tokenizer)[0];assert.equal(c.word,'食べました');assert.equal(c.base,'食べる');assert.equal(c.reading,'たべました');assert.match(localEntry(c).meaning,/吃/);
});
test('context uses hovered occurrence and is bounded',()=>{const text='bank を調べる。'.repeat(80)+'river bank means shore.';const c=sentenceAt(text,text.lastIndexOf('bank'));assert.ok(c.includes('river bank'));assert.ok(c.length<=240);});
