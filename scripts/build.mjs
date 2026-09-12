import { build } from 'esbuild';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';

const banner = `// ==UserScript==
// @name         Yomi · 日英阅读助手
// @namespace    local.yomi.reader
// @version      3.0.7
// @description  日英安全注音与语法识别、中文悬浮资料、统一 Library 和间隔复习，可接自定义 AI
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.listValues
// @grant        GM.deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @connect      cdn.jsdelivr.net
// @connect      *
// @license      MIT
// ==/UserScript==`;

await mkdir('dist', { recursive: true });
await build({ absWorkingDir: process.cwd(), tsconfigRaw: {}, entryPoints: ['./src/main.js'], bundle: true, platform: 'browser', target: ['chrome100','firefox100'], format: 'iife', outfile: 'dist/yomi-reader.user.js', banner: { js: banner }, legalComments: 'inline', minify: false });
// Keep third-party notices next to the installable bundle.
const notices = [`=== Yomi ===\n${await readFile('LICENSE', 'utf8')}`];
for (const [name, file] of [['kuromoji','node_modules/kuromoji/LICENSE-2.0.txt'],['kuromoji NOTICE / IPADIC dictionary','node_modules/kuromoji/NOTICE.md'],['fflate','node_modules/fflate/LICENSE'],['doublearray','node_modules/.pnpm/doublearray@0.0.2/node_modules/doublearray/LICENSE.txt']]) {
  try { notices.push(`=== ${name} ===\n${await readFile(file, 'utf8')}`); } catch {
    if (name === 'kuromoji' || name === 'doublearray') notices.push(`=== ${name} ===\nApache License 2.0. See https://www.apache.org/licenses/LICENSE-2.0`);
    else throw new Error(`Missing license for ${name}`);
  }
}
await writeFile('dist/THIRD-PARTY-NOTICES.txt', notices.join('\n\n'));
const bundled = await readFile('dist/yomi-reader.user.js', 'utf8');
await writeFile('dist/yomi-reader.user.js', `${bundled}\n/*\n${notices.join('\n\n').replace(/\*\//g, '* /')}\n*/\n`);
await copyFile('dist/yomi-reader.user.js', 'demo/yomi-reader.js');
console.log('Built dist/yomi-reader.user.js and demo/yomi-reader.js');
