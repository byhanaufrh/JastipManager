/* Jastip Manager - service worker (offline support). Naikkan VERSION kalau ingin memaksa refresh cache. */
const VERSION='jastip-v2';
const LOCAL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
const CDN=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VERSION);
    await Promise.all(LOCAL.map(u=>c.add(u).catch(()=>{})));
    await Promise.all(CDN.map(u=>fetch(u,{mode:'no-cors'}).then(r=>c.put(u,r)).catch(()=>{})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k!==VERSION)await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET')return;
  if(url.hostname.endsWith('supabase.co'))return;          // data cloud selalu langsung ke server
  if(url.origin===location.origin&&url.pathname.endsWith('rekap.html'))return; // halaman customer tidak di-cache
  // Halaman utama: coba internet dulu (supaya update langsung masuk), kalau gagal pakai cache
  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      const c=await caches.open(VERSION);
      const cached=async()=>(await c.match('index.html'))||(await c.match('./'));
      const net=fetch(req).then(r=>{if(r&&r.ok)c.put('index.html',r.clone());return r});
      // Internet lambat (>3 detik)? tampilkan versi tersimpan dulu; versi baru tetap diunduh untuk buka berikutnya.
      const slow=new Promise(res=>setTimeout(async()=>res(await cached()||null),3000));
      try{const r=await Promise.race([net,slow]);if(r)return r;return await net}
      catch(err){return (await cached())||Response.error()}
    })());return;
  }
  // File lain (library, ikon): cache dulu, perbarui di belakang layar
  if(url.origin===location.origin||url.hostname==='cdn.jsdelivr.net'){
    e.respondWith((async()=>{
      const c=await caches.open(VERSION),hit=await c.match(req);
      const net=fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r}).catch(()=>null);
      return hit||(await net)||Response.error();
    })());
  }
});
