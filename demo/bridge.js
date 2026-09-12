// Demo-only shim. The installable userscript exclusively uses the userscript manager APIs.
const memory = new Map();
window.GM_getValue = (key, fallback) => {
  if (key.startsWith('yomi:dict:')) return memory.get(key) ?? fallback;
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
window.GM_setValue = (key, value) => {
  if (key.startsWith('yomi:dict:')) memory.set(key, value);
  else sessionStorage.setItem(key, JSON.stringify(value));
};
window.GM_deleteValue = key => { memory.delete(key); sessionStorage.removeItem(key); };
window.GM_registerMenuCommand = () => {};
// Learning data uses IndexedDB in the demo, never Web Storage. In an installed
// userscript these asynchronous GM APIs are shared by all matched websites.
const libraryDB = new Promise((resolve,reject)=>{
  const open=indexedDB.open('yomi-demo-library',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('values');
  open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
});
const dbAction=async(mode,fn)=>{
  const db=await libraryDB;
  return new Promise((resolve,reject)=>{const tx=db.transaction('values',mode),request=fn(tx.objectStore('values'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));});
};
window.GM={getValue:async(key,fallback)=>(await dbAction('readonly',s=>s.get(key)))??fallback,setValue:(key,value)=>dbAction('readwrite',s=>s.put(value,key)),deleteValue:key=>dbAction('readwrite',s=>s.delete(key)),listValues:()=>dbAction('readonly',s=>s.getAllKeys())};
window.GM_listValues=()=>[];
window.GM_xmlhttpRequest = options => {
  const dictionary = options.url.startsWith('https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/');
  const url = dictionary ? '/dictionary/' + options.url.split('/').pop().replace('.dat.gz', '.json') : options.url;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 35000);
  fetch(url, { method: options.method, headers: options.headers, body: options.data, credentials:'omit', signal:controller.signal })
    .then(async response => {
      const binary = dictionary && response.ok ? Uint8Array.from(atob((await response.json()).data), c=>c.charCodeAt(0)).buffer : options.responseType === 'arraybuffer' ? await response.arrayBuffer() : undefined;
      options.onload({ status:response.status, response:binary, responseText: options.responseType !== 'arraybuffer' ? await response.text() : '' });
    })
    .catch(error => error.name === 'AbortError' ? options.ontimeout?.() : options.onerror?.())
    .finally(() => clearTimeout(timeout));
  return { abort: () => controller.abort() };
};
