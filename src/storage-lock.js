// A bakery-style cross-tab lease for GM storage (Web Locks are only same-origin).
// No lock or storage read is performed by ordinary hover/index lookups.
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class StorageLock {
  constructor(storage,prefix){this.storage=storage;this.prefix=prefix+'lock:';this.id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;this.key=this.prefix+this.id;}
  async run(fn){
    const s=this.storage,start=Date.now();let lease={choosing:true,ticket:0,expires:start+30000},heartbeat,pending=Promise.resolve();
    const live=entry=>entry&&entry.expires>Date.now();
    try{
      await s.set(this.key,lease);
      const keys=(await s.keys()).filter(k=>k.startsWith(this.prefix));
      const entries=await Promise.all(keys.map(k=>s.get(k)));
      lease={choosing:false,ticket:Math.max(0,...entries.filter(live).map(e=>e.ticket||0))+1,expires:Date.now()+30000};await s.set(this.key,lease);
      // Later arrivals observe our published ticket and wait behind it.
      for(const key of keys.filter(k=>k!==this.key))while(true){
        const other=await s.get(key);
        if(!live(other)||(!other.choosing&&(other.ticket>lease.ticket||(other.ticket===lease.ticket&&key>this.key))))break;
        if(Date.now()-start>12000)throw new Error('另一个页面正在更新资料库，请稍后重试。');
        await pause(35);
      }
      heartbeat=setInterval(()=>{lease.expires=Date.now()+30000;pending=pending.then(()=>s.set(this.key,{...lease})).catch(()=>{});},5000);
      return await fn();
    }finally{clearInterval(heartbeat);await pending;try{if(s.delete)await s.delete(this.key);else await s.set(this.key,null);}catch{/* Abandoned leases expire without blocking future work permanently. */}}
  }
}
