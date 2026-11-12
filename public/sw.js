const CACHE = "progressive-v1";
const STORE = "progressive-offline";
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/workout", "/program"]))));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method === "POST" && new URL(request.url).pathname === "/api/workouts") {
    event.respondWith(fetch(request.clone()).catch(async () => { await queue(request); return new Response(JSON.stringify({ ok: true, queued: true }), { status: 202, headers: { "Content-Type": "application/json" } }); }));
    return;
  }
  if (request.method === "GET") event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); return response; })));
});
self.addEventListener("sync", (event) => { if (event.tag === "sync-workouts") event.waitUntil(flush()); });
self.addEventListener("message", (event) => { if (event.data === "sync-workouts") flush(); });
function db() { return new Promise((resolve, reject) => { const request = indexedDB.open(STORE, 1); request.onupgradeneeded = () => request.result.createObjectStore("requests", { autoIncrement: true }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function queue(request) { const database = await db(); const body = await request.text(); await new Promise((resolve, reject) => { const transaction = database.transaction("requests", "readwrite"); transaction.objectStore("requests").add({ url: request.url, body, headers: [...request.headers] }); transaction.oncomplete = resolve; transaction.onerror = reject; }); if (self.registration.sync) await self.registration.sync.register("sync-workouts"); }
async function flush() { const database = await db(); const items = await new Promise((resolve, reject) => { const transaction = database.transaction("requests", "readonly"); const request = transaction.objectStore("requests").getAll(); request.onsuccess = () => resolve(request.result); request.onerror = reject; }); for (const item of items) { const response = await fetch(item.url, { method: "POST", headers: item.headers, body: item.body }); if (!response.ok) return; } await new Promise((resolve, reject) => { const transaction = database.transaction("requests", "readwrite"); transaction.objectStore("requests").clear(); transaction.oncomplete = resolve; transaction.onerror = reject; }); }
