import Tokenizer from 'kuromoji/src/Tokenizer.js';
import DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries.js';
import { gunzipSync } from 'fflate';
import { request } from './network.js';

const CDN = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/';
export const DICT_FILES = ['base','check','tid','tid_pos','tid_map','cc','unk','unk_pos','unk_map','unk_char','unk_compat','unk_invoke'];
const cachePrefix = 'yomi:dict:0.1.2:';
const toBase64 = bytes => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
};
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
let instance;

export function loadTokenizer(onStatus = () => {}) {
  if (instance) return instance;
  instance = (async () => {
    let count = 0;
    onStatus('正在加载日语词典…');
    const buffers = {};
    // Two concurrent transfers limit memory spikes on ordinary pages.
    const queue = [...DICT_FILES];
    await Promise.all([0, 1].map(async () => {
      while (queue.length) {
        const name = queue.shift();
        let compressed;
        try {
          const cached = GM_getValue(cachePrefix + name, '');
          if (cached) compressed = fromBase64(cached);
          if (compressed) buffers[name] = gunzipSync(compressed).slice().buffer;
        } catch { compressed = undefined; }
        if (!buffers[name]) {
          const response = await request({ method: 'GET', url: `${CDN}${name}.dat.gz`, responseType: 'arraybuffer' });
          compressed = new Uint8Array(response.response);
          if (compressed.length < 18 || compressed[0] !== 31 || compressed[1] !== 139) throw new Error('词典下载内容为空或格式不正确，请检查网络与下载拦截设置。');
          buffers[name] = gunzipSync(compressed).slice().buffer;
          try { GM_setValue(cachePrefix + name, toBase64(compressed)); } catch { /* Cache denial must not disable reading. */ }
        }
        onStatus(`日语词典 ${++count}/${DICT_FILES.length}`);
      }
    }));
    const dic = new DynamicDictionaries();
    dic.loadTrie(new Int32Array(buffers.base), new Int32Array(buffers.check));
    dic.loadTokenInfoDictionaries(new Uint8Array(buffers.tid), new Uint8Array(buffers.tid_pos), new Uint8Array(buffers.tid_map));
    dic.loadConnectionCosts(new Int16Array(buffers.cc));
    dic.loadUnknownDictionaries(new Uint8Array(buffers.unk), new Uint8Array(buffers.unk_pos), new Uint8Array(buffers.unk_map), new Uint8Array(buffers.unk_char), new Uint32Array(buffers.unk_compat), new Uint8Array(buffers.unk_invoke));
    onStatus('日语词典已就绪');
    return new Tokenizer(dic);
  })().catch(error => { instance = undefined; throw error; });
  return instance;
}

export function clearDictionaryCache() {
  for (const name of DICT_FILES) GM_deleteValue(cachePrefix + name);
}
