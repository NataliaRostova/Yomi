import test from 'node:test';
import assert from 'node:assert/strict';
import { hiragana, rubyParts, validateEndpoint, parseAIJSON, validateEntry, cacheKey, LRU } from '../src/core.js';
import { localEntry } from '../src/lexicon.js';
import { AIClient } from '../src/network.js';

test('hiragana and okurigana alignment preserve the surface', () => {
  assert.equal(hiragana('ガッコウ'), 'がっこう');
  assert.equal(hiragana('ﾊﾟﾜｰ'), 'ぱわー');
  assert.deepEqual(rubyParts('食べる', 'タベル'), [{ text:'食', reading:'た' }, { text:'べる' }]);
  assert.deepEqual(rubyParts('取り戻す', 'トリモドス'), [{ text:'取', reading:'と' }, { text:'り' }, { text:'戻', reading:'もど' }, { text:'す' }]);
  assert.deepEqual(rubyParts('今日', 'キョウ'), [{ text:'今日', reading:'きょう' }]);
  assert.deepEqual(rubyParts('未知', ''), [{ text:'未知' }]);
  assert.equal(rubyParts('新しい', 'アタラシイ').map(p => p.text).join(''), '新しい');
});
test('local loanwords preserve source language and warn for wasei-eigo', () => {
  assert.equal(localEntry({ word:'パワー', lang:'ja' }).original, 'power');
  assert.match(localEntry({ word:'アルバイト', lang:'ja' }).original, /Arbeit/);
  assert.match(localEntry({ word:'マンション', lang:'ja' }).usage, /不等同/);
  assert.match(localEntry({ word:'読ん', base:'読む', lang:'ja' }).meaning, /阅读/);
  assert.equal(localEntry({ word:'learned', lang:'en' }).meaning, '学习；得知');
});
test('reject unsafe endpoints without restricting local inference services', () => {
  assert.equal(validateEndpoint('https://example.com/v1/chat/completions'), 'https://example.com/v1/chat/completions');
  assert.equal(validateEndpoint('http://127.0.0.1:11434/v1/chat/completions'), 'http://127.0.0.1:11434/v1/chat/completions');
  for (const value of ['http://remote.example/v1','javascript:alert(1)','https://key:secret@example.com/v1','https://example.com/?key=secret','not a url']) assert.throws(() => validateEndpoint(value));
});
test('strict JSON schema rejects incomplete output and limits string size', () => {
  assert.deepEqual(parseAIJSON('```json\n{"meaning":"力量"}\n```'), { meaning:'力量' });
  assert.deepEqual(parseAIJSON('Here is the result: {"meaning":"力量"}'),{meaning:'力量'});
  assert.throws(() => validateEntry({ usage:'something' }));
  assert.equal(validateEntry({ meaning:'a'.repeat(2000) }).meaning.length, 800);
});
test('context-specific LRU never confuses distinct senses', () => {
  const info = { word:'bank', base:'bank', lang:'en' };
  assert.notEqual(cacheKey(info,'river bank'), cacheKey(info,'bank account'));
  const lru = new LRU(2); lru.set('a',1); lru.set('b',2); lru.get('a'); lru.set('c',3);
  assert.equal(lru.get('b'), undefined); assert.equal(lru.get('a'), 1);
});
test('AI concurrency, deduplication and auth failure release slots', async () => {
  const config = { aiEnabled:true, endpoint:'https://example.com/v1/chat/completions', apiKey:'test-only', model:'mock' };
  let count = 0, active = 0, maximum = 0;
  globalThis.GM_xmlhttpRequest = options => {
    count++; active++; maximum = Math.max(maximum, active);
    setTimeout(() => { active--; options.onload({ status:200, responseText:JSON.stringify({ choices:[{ message:{ content:'{"meaning":"测试","usage":"用法"}' } }] }) }); }, 10);
  };
  const client = new AIClient(() => config);
  const word = { word:'test', base:'test', lang:'en' };
  const first = client.lookup(word); const same = client.lookup(word);
  assert.equal(first, same);
  await Promise.all([first, same, client.lookup({...word, word:'other'}), client.lookup({...word, word:'third'})]);
  assert.equal(count, 3); assert.equal(maximum, 2); assert.equal(client.active, 0);
  globalThis.GM_xmlhttpRequest = options => options.onload({ status:401 });
  await assert.rejects(client.lookup({...word, word:'fail'}), /身份验证失败/);
  assert.equal(client.active, 0); assert.equal(client.pending.size, 0);
});
