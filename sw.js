// Serves play/<path> by decrypting enc/<path>.bin with the key the unlock page stored.
const DB = 'preview-key', STORE = 'k';
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json', wasm: 'application/wasm', png: 'image/png', ttf: 'font/ttf', otf: 'font/otf', txt: 'text/plain; charset=utf-8', frag: 'application/octet-stream', bin: 'application/octet-stream', symbols: 'application/octet-stream' };
function getKey() {
  return new Promise((resolve) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const get = open.result.transaction(STORE).objectStore(STORE).get('key');
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => resolve(null);
    };
  });
}
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const scope = new URL(self.registration.scope);
  const prefix = scope.pathname + 'play/';
  if (url.origin !== scope.origin || !url.pathname.startsWith(prefix)) return;
  e.respondWith(serve(url.pathname.slice(prefix.length), scope));
});
async function serve(rel, scope) {
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const key = await getKey();
  if (!key) return Response.redirect(scope.href, 302);
  const r = await fetch(scope.href + 'enc/' + rel + '.bin', { cache: 'no-cache' });
  if (!r.ok) return new Response('Not found', { status: 404 });
  const buf = new Uint8Array(await r.arrayBuffer());
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(0, 12), additionalData: new TextEncoder().encode(rel) }, key, buf.subarray(12));
    const ext = rel.slice(rel.lastIndexOf('.') + 1).toLowerCase();
    return new Response(plain, { headers: { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' } });
  } catch (_) {
    return Response.redirect(scope.href + '#locked', 302);
  }
}
