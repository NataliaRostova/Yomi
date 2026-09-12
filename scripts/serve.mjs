import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.gz':'application/octet-stream', '.png':'image/png', '.json':'application/json' };
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = decodeURIComponent(url.pathname);
      if (route.split(/[\\/]/).includes('..') || route.includes('\\')) { res.writeHead(403); res.end(); return; }
      // JSON transport keeps the demo working in browsers that intercept binary downloads.
      if (/^\/dictionary\/[a-z_]+\.json$/.test(route)) {
        const name = path.basename(route, '.json');
        const bytes = await readFile(path.join(root, 'node_modules/kuromoji/dict', `${name}.dat.gz`));
        res.writeHead(200, { 'Content-Type':'application/json', 'Cache-Control':'no-cache' });
        res.end(JSON.stringify({ data:bytes.toString('base64') })); return;
      }
      let relative;
      if (route === '/') relative = 'demo/index.html';
      else if (/^\/dict\/[a-z_]+\.dat\.gz$/.test(route)) relative = `node_modules/kuromoji/dict/${path.basename(route)}`;
      else if (/^\/dist\/[a-zA-Z0-9_.-]+$/.test(route)) relative = route.slice(1);
      else if (/^\/verification\/[a-zA-Z0-9_.-]+\.(png|json)$/.test(route)) relative = route.slice(1);
      else relative = `demo/${route.replace(/^\//, '')}`;
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache' }); res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.YOMI_PORT || 4173);
  createServer().listen(port, '127.0.0.1', () => console.log(`Yomi demo: http://127.0.0.1:${port}`));
}
