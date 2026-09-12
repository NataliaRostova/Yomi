import test from 'node:test';import assert from 'node:assert/strict';
import {parseAIJSON,validateEntry} from '../src/core.js';import {AIClient,decodeChatResponse,deepSeekMode} from '../src/network.js';
import {safeOriginal} from '../src/annotation.js';
const envelope=(content,finish_reason='stop',extra={})=>JSON.stringify({choices:[{finish_reason,message:{content,...extra}}]});
const config={aiEnabled:true,endpoint:'https://api.deepseek.com/chat/completions',model:'deepseek-flash',apiKey:'test-only'};
test('wrapped JSON, reasoning envelopes, text content blocks and trailing commas are parsed without altering values',()=>{
 const expected={meaning:'代理；智能体',usage:'a {quoted} value, } stays literal',sourceWord:'agent'};
 for(const text of [JSON.stringify(expected),'下面是结果：\n```json\n'+JSON.stringify(expected)+'\n```\n希望有帮助。','<think>an example {"meaning":"wrong"}</think>\n'+JSON.stringify(expected),JSON.stringify(expected).replace(/}$/ ,',}')])assert.deepEqual(parseAIJSON(text),expected);
 assert.deepEqual(decodeChatResponse(envelope([{type:'reasoning',text:'not an answer'},{type:'text',text:'{"meaning":'},{type:'text',text:'"力量"}'}])),{meaning:'力量'});
 assert.equal(parseAIJSON('{"meaning":"<think>literal</think>"}').meaning,'<think>literal</think>');
});
test('ambiguous, incomplete, executable, array and thought-only responses are rejected instead of inventing entries',()=>{
 for(const text of ['{"meaning":"a"} {"meaning":"b"}','{"meaning":"cut off','{"meaning":"a","nested":{"meaning":"b"}',"{meaning: (() => 'bad')()}",'[{"meaning":"a"}]','<think>{"meaning":"not final"}','{"meaning":"a"} {','just a plain definition'])assert.throws(()=>parseAIJSON(text));
 assert.throws(()=>validateEntry(parseAIJSON('Here is the result: {}')));
 assert.equal(safeOriginal(validateEntry(parseAIJSON('说明：{"meaning":"测试","sourceWord":"这是长解释","sourceWordConfidence":1,"etymologyKind":"borrowed"}'))),'');
});
test('truncation, empty final answer, refusal and incompatible envelopes have distinct diagnostics',()=>{
 assert.throws(()=>decodeChatResponse(envelope('{"meaning":"x','length')),e=>e.code==='AI_TRUNCATED');
 assert.throws(()=>decodeChatResponse(envelope('', 'stop',{reasoning_content:'not exposed'})),e=>e.code==='AI_EMPTY'&&!e.message.includes('not exposed'));
 assert.throws(()=>decodeChatResponse(envelope(null,'stop',{refusal:'refused'})),e=>e.code==='AI_REFUSAL');
 for(const payload of ['<html>gateway</html>','data: {"choices":[]}',JSON.stringify({output_text:'{}'})])assert.throws(()=>decodeChatResponse(payload),e=>e.code==='AI_ENVELOPE');
});
test('DeepSeek Flash automatically uses top-level disabled thinking, JSON mode and a 3200 token output budget for multiple senses',async()=>{
 let body;globalThis.GM_xmlhttpRequest=options=>{body=JSON.parse(options.data);options.onload({status:200,responseText:envelope('{"meaning":"力量"}')});};
 const client=new AIClient(()=>config);assert.equal((await client.lookup({word:'power',lang:'en'})).meaning,'力量');
 assert.deepEqual(body.thinking,{type:'disabled'});assert.deepEqual(body.response_format,{type:'json_object'});assert.equal(body.max_tokens,3200);assert.equal(body.extra_body,undefined);assert.equal(body.temperature,undefined);
 assert.equal(deepSeekMode({...config,aiCompatibility:'generic'}),false);assert.equal(deepSeekMode({...config,model:'other-model'}),false);assert.equal(deepSeekMode({...config,model:'vendor-alias',aiCompatibility:'deepseek'}),true);
});
test('truncated response gets only one fresh retry, with a larger budget and no echoed reasoning',async()=>{
 const sent=[];globalThis.GM_xmlhttpRequest=options=>{const body=JSON.parse(options.data);sent.push(body);options.onload({status:200,responseText:sent.length===1?envelope('','length',{reasoning_content:'private reasoning'}):envelope('结果：{"meaning":"词义"}')});};
 const client=new AIClient(()=>config);assert.equal((await client.lookup({word:'test',lang:'en'})).meaning,'词义');assert.equal(sent.length,2);assert.equal(sent[1].max_tokens,4096);assert.ok(!JSON.stringify(sent).includes('private reasoning'));assert.equal(client.active,0);
 let failed=0;globalThis.GM_xmlhttpRequest=options=>{failed++;options.onload({status:200,responseText:envelope('not JSON')});};
 const bad=new AIClient(()=>config);await assert.rejects(bad.lookup({word:'bad',lang:'en'}),/自动重试一次/);assert.equal(failed,2);assert.equal(bad.cache.map.size,0);assert.equal(bad.pending.size,0);assert.equal(bad.active,0);
});
test('authentication failures and cancellations never trigger format retries',async()=>{
 let calls=0;globalThis.GM_xmlhttpRequest=options=>{calls++;options.onload({status:401});};await assert.rejects(new AIClient(()=>config).lookup({word:'x',lang:'en'}));assert.equal(calls,1);
 const controller=new AbortController();globalThis.GM_xmlhttpRequest=options=>{calls++;queueMicrotask(()=>controller.abort());return {abort(){}};};await assert.rejects(new AIClient(()=>config).lookup({word:'x',lang:'en'},'',false,controller.signal),e=>e.name==='AbortError');assert.equal(calls,2);
});
