// ERS Runners - Service Worker (V1.5 Profile update)
const CACHE_NAME = 'ers-runners-v1.5-fast'; // تحديث رقم النسخة
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.png'
];

// 1. التثبيت (Install)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. التفعيل وحذف الكاش القديم (Activate)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('تنظيف كاش قديم:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. استراتيجية السرعة القصوى (Stale-While-Revalidate)
self.addEventListener('fetch', (event) => {
  // استثناء طلبات الفايربيس (يجب أن تكون مباشرة دائماً)
  if (event.request.url.includes('firestore') || 
      event.request.url.includes('googleapis') || 
      event.request.url.includes('auth')) {
    return; 
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. حاول العثور على الملف في الكاش أولاً
      const cachedResponse = await cache.match(event.request);
      
      // 2. قم بطلب تحديث من الشبكة في الخلفية للمرة القادمة
      const networkFetch = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => {
        // لو مفيش نت، مش مشكلة، إحنا عرضنا الكاش خلاص
      });

      // 3. لو الملف موجود في الكاش اعرضه فوراً (سرعة)، وإلا انتظر الشبكة
      return cachedResponse || networkFetch;
    })
  );
});
