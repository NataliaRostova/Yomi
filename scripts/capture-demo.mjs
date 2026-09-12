import {chromium} from 'playwright';import {createServer} from './serve.mjs';
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:process.env.YOMI_BROWSER||'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 await page.addInitScript(()=>{const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const root=attach.call(this,o);if(this.hasAttribute('data-yomi-root'))window.__shot=root;return root;};});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(()=>document.querySelectorAll('#japanese rt').length>5,null,{timeout:60000});
 const point=await page.locator('#loanwords').evaluate(e=>{const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;if(n.nodeValue==='パワー'){const r=document.createRange();r.setStart(n,0);r.setEnd(n,1);const b=r.getBoundingClientRect();return{x:(b.left+b.right)/2,y:(b.top+b.bottom)/2};}}throw Error('Missing power');});
 await page.mouse.move(point.x,point.y);await page.waitForFunction(()=>!window.__shot.querySelector('.tooltip').hidden&&window.__shot.querySelector('.word').textContent==='パワー');
 await page.evaluate(()=>window.__shot.querySelector('.details').open=true);await page.waitForTimeout(220);
 await page.screenshot({path:'verification/after-desktop-same-page.png',fullPage:true});
 console.log('Captured actual v2 word card on the same demo page and viewport as the v1 screenshot.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
