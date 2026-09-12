import {chromium} from 'playwright';
import {createServer} from '../scripts/serve.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.YOMI_BROWSER||'msedge',headless:true});
await mkdir('verification/regression-v3',{recursive:true});
const results=[],errors=[];let page;
function pass(name){results.push(name);console.log('PASS:',name);}
async function createPage(config={}){
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(config=>{
  sessionStorage.setItem('yomi:config',JSON.stringify(config));
  const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const s=attach.call(this,options);if(this.hasAttribute('data-yomi-root'))window.__testShadow=s;return s;};
 },config);return p;
}
const ui=async(selector,action='click',value)=>page.evaluate(({selector,action,value})=>{
 const e=window.__testShadow.querySelector(selector);if(!e)throw Error(selector);
 if(action==='click')e.click();if(action==='value')e.value=value;if(action==='checked')e.checked=value;
 if(action==='text')return e.textContent;if(action==='hidden')return e.hidden;if(action==='attr')return e.getAttribute(value);
},{selector,action,value});
const waitTip=word=>page.waitForFunction(word=>{const s=window.__testShadow;return !s.querySelector('.tooltip').hidden&&s.querySelector('.word').textContent===word;},word,{timeout:6000});
async function raw(selector){return page.locator(selector).evaluate(e=>{const copy=e.cloneNode(true);copy.querySelectorAll('rt,rp').forEach(n=>n.remove());return copy.textContent;});}
async function glyph(selector,text,character=1){
 await page.locator(selector).scrollIntoViewIfNeeded();await page.waitForTimeout(120);
 return page.locator(selector).evaluate((element,{text,character})=>{
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest('rt,rp,[data-yomi-ui]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const pieces=[];let full='';while(walker.nextNode()){const node=walker.currentNode;pieces.push({node,start:full.length});full+=node.nodeValue;}
  const found=full.indexOf(text);if(found<0)throw Error(`Missing ${text} in ${full}`);const at=found+Math.min(character,text.length-1);
  const piece=[...pieces].reverse().find(p=>p.start<=at);const range=document.createRange();range.setStart(piece.node,at-piece.start);range.setEnd(piece.node,Math.min(piece.node.length,at-piece.start+1));const b=range.getBoundingClientRect();return {x:(b.left+b.right)/2,y:(b.top+b.bottom)/2};
 },{text,character});
}
async function hover(selector,text,expected=text,character=1){
 await page.keyboard.press('Escape');await page.mouse.move(2,2);await page.waitForTimeout(310);const p=await glyph(selector,text,character);await page.mouse.move(p.x,p.y);await waitTip(expected);return p;
}
async function screenshot(name){await page.waitForTimeout(220);await page.screenshot({path:`verification/regression-v3/${name}.png`,fullPage:false});}
async function bounds(selector='.tooltip'){
 return page.evaluate(selector=>{const e=window.__testShadow.querySelector(selector),b=e.getBoundingClientRect(),v=visualViewport;return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:v.width,height:v.height,x:v.offsetLeft,y:v.offsetTop};},selector);
}
function inside(b){assert.ok(b.left>=b.x-1&&b.top>=b.y-1&&b.right<=b.x+b.width+1&&b.bottom<=b.y+b.height+1,JSON.stringify(b));}
try{
 page=await createPage();await page.goto(base+'/verification.html');
 await page.waitForFunction(()=>document.querySelectorAll('#ja rt').length>=4,null,{timeout:60000});
 assert.equal(await page.locator('[data-yomi-root]').evaluate(e=>e.shadowRoot),null);
 await hover('#ja','学ぶ');assert.match(await ui('.meaning','text'),/学习/);await ui('.details summary');await screenshot('after-wordcard-light');
 assert.equal(await page.locator('#kana rt').count(),0);await hover('#kana','こんにちは');assert.equal(await ui('.tooltip','attr','data-state'),'empty');
 await hover('#unknown','quizzaciously');assert.equal(await ui('.tooltip','attr','data-state'),'empty');assert.ok((await ui('.tooltip .actions','text')).includes('AI'));
 await ui('.tooltip .actions button');assert.match(await ui('.tooltip .error','text'),/尚未配置 AI/);await screenshot('after-unconfigured');
 pass('已标注词、无注音纯假名、生词均可查询；AI 未配置时补救入口可见');

 await hover('#ja','食べました');assert.match(await ui('.reading','text'),/食べる/);assert.match(await ui('.meaning','text'),/吃/);
 await hover('#phrases','looked','looked it up');assert.match(await ui('.reading','text'),/look up/);assert.match(await ui('.meaning','text'),/查阅/);
 await hover('#phrases','gave','gave up');assert.match(await ui('.meaning','text'),/放弃/);
 await hover('#inflections','children');assert.match(await ui('.reading','text'),/child/);
 await hover('#inflections','studies');assert.match(await ui('.reading','text'),/study/);
 await hover('#inflections','well‑known');assert.match(await ui('.meaning','text'),/著名/);
 pass('真实 IPADIC 活用还原；英文不规则词形、连字符与已收录短语动词');

 await hover('#split-en','understand','understand',2);assert.match(await ui('.meaning','text'),/理解/);
 await hover('#split-en','understand','understand',7);assert.equal(await page.locator('#split-link').count(),1);
 await page.keyboard.press('Escape');await page.locator('#split-link').click();assert.equal(await page.evaluate(()=>window.linkClicks),1);
 await hover('#split-ja','日本語');assert.match(await ui('.reading','text'),/にほんご/);
 assert.equal(await raw('#split-ja'),'日本語を学ぶ。');assert.equal(await page.locator('#split-ja strong').count(),1);assert.equal(await page.locator('#ja-link').count(),1);
 await hover('#width-ja','ﾊﾟﾜｰ');assert.equal(await raw('#width-ja'),'ﾊﾟﾜｰ と アルバイト。');assert.match(await ui('.reading','text'),/power/);
 await hover('#width-en','ＰＯＷＥＲ');assert.match(await ui('.meaning','text'),/力量/);assert.equal(await raw('#width-en'),'ＰＯＷＥＲ café');
 pass('跨链接/加粗的日英单词；原链接事件、节点结构与 Unicode 原文保持');

 await page.keyboard.press('Escape');await page.locator('#append').click();await page.waitForFunction(()=>document.querySelector('#dynamic rt'));
 await hover('#dynamic','使う');assert.match(await ui('.meaning','text'),/使用/);
 await page.evaluate(()=>document.querySelector('#mutable').firstChild.nodeValue='A brandnewlexeme appears.');await hover('#mutable','brandnewlexeme');assert.equal(await ui('.tooltip','attr','data-state'),'empty');
 const count=await page.locator('[data-yomi-token]').count();await page.waitForTimeout(500);assert.equal(await page.locator('[data-yomi-token]').count(),count);assert.equal(await page.locator('[data-yomi-token] [data-yomi-token]').count(),0);
 pass('动态插入与原 Text 节点更新；无重复注音或观察器循环');

 await ui('.launcher');await screenshot('after-settings-light');await ui('[name=annotationEnabled]','checked',false);await ui('.save');await ui('.settings .close');
 await page.waitForFunction(()=>document.querySelectorAll('[data-yomi-token]').length===0);await hover('#ja','学ぶ');assert.match(await ui('.meaning','text'),/学习/);await hover('#unknown','nebulaflux');
 await ui('.pin');await page.mouse.move(2,2);await page.waitForTimeout(450);assert.equal(await ui('.tooltip','hidden'),false);assert.equal(await ui('.pin','attr','aria-pressed'),'true');await page.keyboard.press('Escape');await page.waitForTimeout(220);assert.equal(await ui('.tooltip','hidden'),true);
 await hover('#unknown','nebulaflux');await ui('.tooltip .actions button:nth-child(2)');await ui('.query-text','value','give up');await ui('.query-apply');await waitTip('give up');assert.match(await ui('.meaning','text'),/放弃/);
 pass('关闭自动注音仍可查询；固定词卡、Esc 和手动调整范围');

 await page.keyboard.press('Escape');await page.locator('#selection').scrollIntoViewIfNeeded();
 await page.locator('#selection').evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r);});
 await page.keyboard.press('Alt+y');await waitTip('Language changes how we understand the world.');assert.equal(await ui('.pin','attr','aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>getSelection().toString()),'Language changes how we understand the world.');
 await page.evaluate(()=>getSelection().removeAllRanges());await page.keyboard.press('Escape');
 await ui('.launcher');await ui('[name=annotationEnabled]','checked',true);await ui('.save');await ui('.settings .close');await page.waitForFunction(()=>document.querySelector('#ja rt'));
 const copied=await page.locator('#ja').evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);getSelection().removeAllRanges();getSelection().addRange(r);const data=new DataTransfer();e.dispatchEvent(new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:data}));const text=data.getData('text/plain');getSelection().removeAllRanges();return text;});
 assert.equal(copied,'日本語を学ぶ。昨日、パンを食べました。');
 pass('整句划词、快捷键、选区保留；复制去除脚本注音');

 assert.equal(await page.locator('#code [data-yomi-token],#editable [data-yomi-token],#chinese [data-yomi-token]').count(),0);
 await hover('#existing-ruby','東京');assert.match(await ui('.meaning','text'),/东京/);assert.equal(await page.locator('#existing-ruby ruby ruby').count(),0);
 pass('已有 ruby 可查但不重复标注；输入框、编辑区、代码、中文段落排除');

 const sent=[];
 await page.route('**/mock/chat/completions',async route=>{
   const payload=route.request().postDataJSON();sent.push(payload);const data=JSON.parse(payload.messages[1].content);
   if(data.word==='networkfailure'){await route.abort('failed');return;}
   if(data.word==='slowword')await new Promise(r=>setTimeout(r,1600));
   if(Array.isArray(data)){await route.fulfill({json:{choices:[{message:{content:JSON.stringify(Object.fromEntries(data.map(w=>[w,{sourceWord:'technology',sourceWordConfidence:.96,etymologyKind:'borrowed'}])))}}]}});return;}
   const entry={meaning:`${data.word} 的中文释义 <img src=x>`,usage:'示例用法，仅用于自动化测试。',reading:'',original:'',example:'A sample sentence.',translation:'一条例句。'};
   await route.fulfill({json:{choices:[{message:{content:JSON.stringify(entry)}}]}});
 });
 await ui('.launcher');await ui('[data-tab=ai]');await ui('[name=aiEnabled]','checked',true);await ui('[name=endpoint]','value',base+'/mock/chat/completions');await ui('[name=model]','value','mock-model');await ui('[name=apiKey]','value','test-key');await ui('[name=sendContext]','checked',true);await ui('.save');await ui('.settings .close');
 await page.evaluate(()=>{const p=document.createElement('p');p.id='network';p.lang='en';const s=document.createElement('span');s.textContent='slowword';s.style.marginRight='480px';p.append(s,document.createTextNode(' fastword networkfailure'));document.querySelector('main').append(p);});
 await hover('#network','slowword');await page.waitForFunction(()=>window.__testShadow.querySelector('.tooltip').dataset.state==='loading');await screenshot('after-loading');
 const fast=await glyph('#network','fastword');await page.mouse.move(fast.x,fast.y);await waitTip('fastword');await page.waitForFunction(()=>window.__testShadow.querySelector('.meaning').textContent.includes('fastword 的'));
 await page.waitForTimeout(1800);assert.equal(await ui('.word','text'),'fastword');assert.equal(await page.evaluate(()=>window.__testShadow.querySelectorAll('.tooltip img').length),0);await screenshot('after-ai');
 assert.ok(sent.some(s=>JSON.parse(s.messages[1].content).context.includes('slowword fastword')));assert.ok(!JSON.stringify(sent).includes('test-key'));
 await hover('#network','networkfailure');await page.waitForFunction(()=>window.__testShadow.querySelector('.tooltip').dataset.state==='error');assert.match(await ui('.tooltip .error','text'),/网络请求失败/);await screenshot('after-network-error');await hover('#edge','power');assert.match(await ui('.meaning','text'),/力量/);
 pass('实际异步请求：加载/成功/网络失败状态、过时结果抑制、上下文隔离及安全文本渲染');

 await ui('.launcher');await ui('[name=autoOriginals]','checked',true);await ui('.save');await ui('.settings .close');
 await page.evaluate(()=>{const p=document.createElement('p');p.id='auto';p.lang='ja';p.textContent='テクノロジー';document.querySelector('main').append(p);p.scrollIntoView();});await page.waitForFunction(()=>document.querySelector('#auto rt')?.textContent==='technology');assert.equal(await page.locator('#auto [data-ai-original]').count(),1);
 pass('保留自动 AI 外来词补全，并标明 AI 推断来源');

 for(const theme of ['light','dark']){
  await ui('.launcher');await ui('[name=theme]','value',theme);await ui('.save');await ui('.settings .close');await page.evaluate(theme=>document.body.dataset.dark=String(theme==='dark'),theme);
  for(const zoom of [.8,1,1.25,1.75]){
    await page.evaluate(zoom=>document.documentElement.style.zoom=String(zoom),zoom);await hover('#edge','power');inside(await bounds());
  }
 }
 await page.evaluate(()=>document.documentElement.style.zoom='1');await hover('#edge','power');await screenshot('after-wordcard-dark');await ui('.launcher');await screenshot('after-settings-dark');inside(await bounds('.settings'));
 await ui('.settings .close');await page.setViewportSize({width:390,height:844});await ui('.launcher');inside(await bounds('.settings'));await screenshot('after-settings-mobile');
 pass('浅/深色界面与页面；80/100/125/175% CSS 布局缩放；390px 窄屏及边缘换位');

 await page.close();page=await createPage();await page.route('**/dictionary/*.json',route=>route.abort('failed'));await page.goto(base+'/verification.html');
 await page.waitForFunction(()=>window.__testShadow.querySelector('.status').textContent.includes('不可用'));await hover('#kana','こんにちは');assert.equal(await ui('.tooltip','hidden'),false);await hover('#ja','学ぶ');assert.match(await ui('.meaning','text'),/学习/);await hover('#unknown','quizzaciously');assert.equal(await ui('.tooltip','attr','data-state'),'empty');
 pass('词典网络加载失败后，纯假名、日语基础词与生词查询仍可用');
 assert.deepEqual(errors,[]);pass('浏览器运行时无未捕获异常');
 await writeFile('verification/regression-v3/results.json',JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),results,errors,ai:'mocked transport; no real account',zoom:'CSS layout zoom, not browser toolbar zoom'},null,2));
}catch(error){console.error('FAILED',error);if(page&&!page.isClosed()){console.error(await page.evaluate(()=>({status:window.__testShadow?.querySelector('.status')?.textContent,word:window.__testShadow?.querySelector('.word')?.textContent,meaning:window.__testShadow?.querySelector('.meaning')?.textContent,error:window.__testShadow?.querySelector('.tooltip .error')?.textContent,annotations:document.querySelectorAll('[data-yomi-token]').length})));await page.screenshot({path:'verification/regression-v3/failure.png',fullPage:true});}throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));}
