import {chromium} from 'playwright';
import {createServer} from './serve.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Record the production userscript. No fabricated dictionary / AI / Library data.
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:820},deviceScaleFactor:1});
const root='.test-output/showcase',manifest=[];await mkdir(root,{recursive:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const s=attach.call(this,o);if(this.hasAttribute('data-yomi-root'))window.ui=s;return s;};});
const pause=ms=>page.waitForTimeout(ms);
const step=text=>page.locator('#demo-step').evaluate((e,t)=>e.textContent=t,text);
async function cursor(x,y){await page.evaluate(({x,y})=>{let e=document.querySelector('#record-pointer');if(!e){e=document.createElement('div');e.id='record-pointer';e.dataset.yomiUi='';e.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;width:16px;height:16px;border:2px solid #af732c;background:#d1ab6333;border-radius:50%;transform:translate(-50%,-50%)';document.body.append(e);}e.style.left=x+'px';e.style.top=y+'px';},{x,y});await page.mouse.move(x,y,{steps:4});}
async function hit(selector,label,action='click'){
 const p=await page.evaluate(({selector,label})=>{const e=[...ui.querySelectorAll(selector)].find(e=>!label||e.textContent.includes(label));if(!e)throw Error(selector+':'+label);e.scrollIntoView({block:'nearest'});const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};},{selector,label});await pause(120);await cursor(p.x,p.y);if(action==='click')await page.mouse.click(p.x,p.y);await pause(350);
}
async function hover(selector,word,inCard=false){
 const p=await page.evaluate(({selector,word,inCard})=>{const e=(inCard?ui:document).querySelector(selector);const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest('rt,[data-yomi-ui]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});let text='',parts=[];while(w.nextNode()){parts.push({n:w.currentNode,start:text.length});text+=w.currentNode.nodeValue;}const at=text.indexOf(word);if(at<0)throw Error(word);const item=parts.findLast(p=>p.start<=at),r=document.createRange();r.setStart(item.n,at-item.start);r.setEnd(item.n,at-item.start+1);const b=r.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};},{selector,word,inCard});await cursor(p.x,p.y);await page.waitForFunction(({word,inCard})=>ui.querySelector(inCard?'.child-word':'.word').textContent===word,{word,inCard});await pause(400);
}
async function record(name,actions){await mkdir(root+'/'+name,{recursive:true});let running=true;const frames=[];const started=Date.now();const capture=(async()=>{while(running){const file=`${String(frames.length).padStart(4,'0')}.png`;const t=Date.now()-started;await page.screenshot({path:`${root}/${name}/${file}`});frames.push({file,t});await pause(70);}})();try{await actions();await pause(1400);}finally{running=false;await capture;}manifest.push({name,frames,duration:Date.now()-started});console.log('Recorded',name,frames.length,'frames');}
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/showcase.html`);await page.waitForFunction(()=>document.querySelector('#inflected rt'),null,{timeout:60000});await pause(500);
 await record('hover-reading',async()=>{await step('01 / 假名与短词源 · 悬浮换词，资料卡保持打开');await pause(1200);await hover('#grammar','ものの');await pause(1600);await hover('#finance','金融政策');await pause(1600);await hover('#loans','データセンター');await pause(1600);assert.equal(await page.evaluate(()=>ui.querySelector('.word').textContent),'データセンター');});
 await page.keyboard.press('Escape');await pause(400);await hover('#grammar','ものの');
 await record('example-explorer',async()=>{await step('02 / 展开用法 → 例句里继续查词 → 返回原卡');await hit('.tooltip .details summary');await pause(1500);await hover('.tooltip .source-sentence','個人消費',true);await pause(2200);assert.equal(await page.evaluate(()=>ui.querySelector('.word').textContent),'ものの');await hit('.child-close');await pause(900);});
 await page.keyboard.press('Escape');await pause(400);await hover('#inflected','踏まえる');
 await record('collect-review',async()=>{await step('03 / 选择多个分类，一份资料保存原句和学习进度');await hit('.tooltip .actions button','收录');for(const name of ['日语','新闻']){await hit('.collection-name');await page.keyboard.type(name);await hit('.collection-create');}await pause(1300);assert.equal(await page.evaluate(()=>ui.querySelectorAll('.collection-choices input:checked').length),2);await hit('.collection-save');await pause(700);await hit('.tooltip .actions button','Library');await page.waitForFunction(()=>ui.querySelectorAll('.library-item').length===1);await pause(1500);await step('04 / 使用读过的原句复习，揭晓后按掌握程度评分');await hit('.review-tab');await page.evaluate(()=>ui.querySelector('.quiz-mode').value='cloze');await hit('.start-review');await pause(1800);await hit('.reveal');await pause(1900);assert.equal(await page.evaluate(()=>ui.querySelector('.quiz-answer').hidden),false);await hit('.grade-actions button','一般');await pause(900);});
 assert.deepEqual(errors,[]);await writeFile(root+'/manifest.json',JSON.stringify({browser:await browser.version(),createdAt:new Date().toISOString(),viewport:{width:1200,height:820},manifest,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
