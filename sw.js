/* Uceni Games mobile app shell.
 * Only public, immutable-style presentation assets are cached.
 * Never cache HTML, API responses, authentication tokens, gameplay,
 * results, admin pages, billing or private learner information.
 * Internet remains required for the actual game.
 */
const CACHE="uceni-static-v2";
const ALLOW=new Set([
 "/css/app.css","/js/app.js","/js/config.js","/js/badge-share.js",
 "/favicon.svg","/assets/uceni-wordmark.svg",
 "/assets/uceni-wordmark-white.svg","/assets/uceni-icon-white.svg"
]);
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled([...ALLOW].map(async url=>{
      const response=await fetch(url,{cache:"no-store"});
      if(response.ok)await cache.put(url,response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("uceni-static-")&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
  const path=new URL(req.url).pathname;
  if(!ALLOW.has(path))return; // network only: pages, quiz actions and personal data
  event.respondWith((async()=>{
    try{
      const response=await fetch(req);
      if(response.ok){const c=await caches.open(CACHE);await c.put(req,response.clone());}
      return response;
    }catch(e){
      const cached=await caches.match(req);
      if(cached)return cached;
      return Response.error();
    }
  })());
});
