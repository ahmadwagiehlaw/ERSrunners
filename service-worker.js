// ERS Runners - Service Worker
const CACHE_NAME = 'ers-runners-v1.8';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.png' 
  // تأكد أن أسماء الصور هنا تطابق الموجود عندك بالضبط (jpg أو png)
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
            console.log('مسح الكاش القديم:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. جلب الملفات (Fetch Strategy: Network First)
// يحاول يجيب أحدث نسخة من النت، لو فشل (أوفلاين) يجيب من الكاش
self.addEventListener('fetch', (event) => {
  // تجاهل طلبات الفايربيس (عشان الداتابيز تشتغل صح)
  if (event.request.url.includes('firestore') || event.request.url.includes('googleapis')) {
    return; 
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // لو نجحنا نجيب نسخة جديدة، نخزنها في الكاش للمرة الجاية
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // لو مفيش نت، هات من الكاش
        return caches.match(event.request);
      })
  );
});
